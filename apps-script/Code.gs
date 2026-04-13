/**
 * Meyer Decision – Internal OS – Apps Script Backend
 * ===================================================
 * Handles email dispatch for the Operations workflow.
 *
 * Deploy as Web App:  Execute as "Me", Access "Anyone"
 * Set Script Property: DRIVE_FOLDER_ID = 1kmVU2amSfn6JwTtVZfmqpV-VA7CPe0Rg
 */

// ── Config ─────────────────────────────────────────────
const DRIVE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID')
  || '1kmVU2amSfn6JwTtVZfmqpV-VA7CPe0Rg';

// Map workflow type → subfolder name inside the Drive folder
const SUBFOLDER_MAP = {
  angebot:    '01_Angebot',
  vertrag:    '02_DL Vertrag',
  unterlagen: '03_Unterlagen nach Unterschrift',
  reminder:   '04_Datenupload',
  rechnung:   '05_Rechnung',
};

// Files to attach per workflow step (matched by filename substring)
const ATTACHMENT_RULES = {
  angebot: [
    { match: 'Angebot', exclude: 'Begleitemail' },
  ],
  vertrag: [
    { match: 'Dienstleistungsvertrag' },
    { match: 'Anlage_1' },
    { match: 'Anlage_2_AVV' },
    { match: 'Anlage_2a_TOM' },
    { match: 'Anlage_3' },
  ],
  unterlagen: [
    { match: 'daten_anleitung' },
  ],
  reminder: [],
  rechnung: [
    { match: 'Rechnung_Meyer_Decision_Template' },
  ],
};

// ── Web App Entry Point ────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    var result;
    switch (action) {
      case 'ops_prepare':
        result = handlePrepare(payload);
        break;
      case 'ops_send':
        result = handleSend(payload);
        break;
      case 'health':
        result = { status: 'ok', timestamp: new Date().toISOString() };
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message, stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Also support GET for health checks
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'Meyer Decision Internal OS', timestamp: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── PREPARE: Build email preview with attachment info ──
function handlePrepare(payload) {
  var type = payload.type;
  var customerId = payload.customer_id;
  var sender = payload.sender;

  // Collect attachment metadata from Drive
  var attachments = getAttachmentInfo(type);

  return {
    data: {
      type: type,
      customer_id: customerId,
      from: sender,
      attachments: attachments,
    },
  };
}

// ── SEND: Dispatch email via GmailApp ──────────────────
function handleSend(payload) {
  var type = payload.type;
  var to = payload.to;
  var sender = payload.sender;
  var subject = payload.subject;
  var htmlBody = payload.body;

  if (!to || !subject || !htmlBody) {
    return { error: 'Missing required fields: to, subject, body' };
  }

  // Gather actual file blobs from Drive as PDF attachments
  var attachmentBlobs = getAttachmentBlobs(type);

  // Build email options
  var options = {
    htmlBody: htmlBody,
    name: getSenderName(sender),
    replyTo: sender,
  };

  if (attachmentBlobs.length > 0) {
    options.attachments = attachmentBlobs;
  }

  // Send via GmailApp (always sends from the script owner's account)
  GmailApp.sendEmail(to, subject, '', options);

  return {
    success: true,
    message: 'E-Mail gesendet an ' + to,
    attachmentCount: attachmentBlobs.length,
  };
}

// ── Helper: Get attachment metadata (name + size) ──────
function getAttachmentInfo(type) {
  var rules = ATTACHMENT_RULES[type] || [];
  if (rules.length === 0) return [];

  var subfolder = getSubfolder(type);
  if (!subfolder) return [];

  var result = [];
  var files = subfolder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    var fileName = file.getName();

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (fileName.indexOf(rule.match) !== -1) {
        if (rule.exclude && fileName.indexOf(rule.exclude) !== -1) continue;
        result.push({
          name: toPdfName(fileName),
          size: formatFileSize(file.getSize()),
        });
        break;
      }
    }
  }

  return result;
}

// ── Helper: Get actual file blobs as PDFs ──────────────
function getAttachmentBlobs(type) {
  var rules = ATTACHMENT_RULES[type] || [];
  if (rules.length === 0) return [];

  var subfolder = getSubfolder(type);
  if (!subfolder) return [];

  var blobs = [];
  var files = subfolder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    var fileName = file.getName();

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (fileName.indexOf(rule.match) !== -1) {
        if (rule.exclude && fileName.indexOf(rule.exclude) !== -1) continue;

        // Convert Google Docs / .docx to PDF, or use file as-is for PDFs/XML
        var blob;
        var mimeType = file.getMimeType();

        if (mimeType === 'application/vnd.google-apps.document') {
          // Google Docs → export as PDF
          blob = file.getAs('application/pdf');
          blob.setName(toPdfName(fileName));
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
          // .docx → convert via temporary Google Doc → PDF
          blob = convertDocxToPdf(file);
        } else if (fileName.endsWith('.html')) {
          // HTML → convert to PDF via HtmlService
          blob = file.getAs('application/pdf');
          blob.setName(toPdfName(fileName));
        } else {
          // PDF, XML, etc. → attach as-is
          blob = file.getBlob();
        }

        blobs.push(blob);
        break;
      }
    }
  }

  return blobs;
}

// ── Helper: Convert .docx to PDF via temporary Google Doc ──
function convertDocxToPdf(file) {
  // Create a temporary Google Doc from the .docx
  var tempDoc = Drive.Files.copy(
    { title: 'TEMP_' + file.getName(), mimeType: 'application/vnd.google-apps.document' },
    file.getId()
  );

  // Export as PDF
  var pdfBlob = DriveApp.getFileById(tempDoc.id).getAs('application/pdf');
  pdfBlob.setName(toPdfName(file.getName()));

  // Clean up temp file
  DriveApp.getFileById(tempDoc.id).setTrashed(true);

  return pdfBlob;
}

// ── Helper: Get subfolder from Drive ───────────────────
function getSubfolder(type) {
  var folderName = SUBFOLDER_MAP[type];
  if (!folderName) return null;

  try {
    var root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var subfolders = root.getFoldersByName(folderName);
    if (subfolders.hasNext()) {
      return subfolders.next();
    }
  } catch (err) {
    Logger.log('Error accessing folder: ' + err.message);
  }

  return null;
}

// ── Helper: Format file size ───────────────────────────
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Helper: Convert filename to .pdf extension ─────────
function toPdfName(fileName) {
  return fileName
    .replace(/\.(docx|doc|html|gdoc)$/i, '.pdf')
    .replace(/\s+/g, '_');
}

// ── Helper: Get display name from email ────────────────
function getSenderName(email) {
  if (email === 'nhi@meyerdecision.com') return 'Nhi Meyer – Meyer Decision';
  return 'Gregory Meyer – Meyer Decision';
}

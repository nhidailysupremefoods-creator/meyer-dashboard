/**
 * Meyer Decision – Internal OS – Apps Script Backend
 * ===================================================
 * Handles email dispatch (Seite 3) and mandate sync from Drive (Seite 2).
 *
 * Deploy as Web App:  Execute as "Me", Access "Anyone"
 * Services needed:   Drive API (Advanced Service)
 * Script Properties:
 *   DRIVE_FOLDER_ID      = 1kmVU2amSfn6JwTtVZfmqpV-VA7CPe0Rg  (Begleitmail-Vorlagen)
 *   KUNDEN_FOLDER_ID     = 1opLoHnHgPat85NsoDOpUB5dc0bgq0AmE  (02_KUNDEN Ordner für Verträge)
 *   KUNDEN_UPLOAD_FOLDER = (ID of the root folder containing per-customer upload folders)
 */

// ── Config ─────────────────────────────────────────────
const PROPS = PropertiesService.getScriptProperties();
const DRIVE_FOLDER_ID = PROPS.getProperty('DRIVE_FOLDER_ID')
  || '1kmVU2amSfn6JwTtVZfmqpV-VA7CPe0Rg';

// Hauptordner mit allen Kundenordnern (enthält 02_VERTRAG Unterordner)
const KUNDEN_FOLDER_ID = PROPS.getProperty('KUNDEN_FOLDER_ID')
  || '1opLoHnHgPat85NsoDOpUB5dc0bgq0AmE';

// Root folder that contains per-customer subfolders for monthly data uploads
// Structure: KUNDEN_UPLOAD_FOLDER / [Kundenname] / [YYYY-MM] / files...
// If not set, falls back to DRIVE_FOLDER_ID / 04_Datenupload / [Kundenname]
const KUNDEN_UPLOAD_FOLDER = PROPS.getProperty('KUNDEN_UPLOAD_FOLDER') || '';

// Expected file types per monthly upload (substring match)
const EXPECTED_FILES = ['BWA', 'SuSa'];

// Deadline: data must be uploaded by this day of the month
const UPLOAD_DEADLINE_DAY = 10;

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
      case 'sync_mandates':
        result = syncMandates();
        break;
      case 'ops_prepare':
        result = handlePrepare(payload);
        break;
      case 'ops_send':
        result = handleSend(payload);
        break;
      case 'check_uploads':
        result = handleCheckUploads(payload);
        break;
      case 'validate_data':
        result = handleValidateData(payload);
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

// ── CHECK UPLOADS: Scan Drive for customer data ─────────
// Checks if each customer has uploaded their monthly data files
// Returns per-customer status: { daten_erhalten, file_count, last_upload_date, files }
function handleCheckUploads(payload) {
  var customers = payload.customers || []; // [{customer_id, company_name}]
  var now = new Date();
  var currentMonth = Utilities.formatDate(now, 'Europe/Berlin', 'yyyy-MM');
  var dayOfMonth = now.getDate();
  var isOverdue = dayOfMonth > UPLOAD_DEADLINE_DAY;

  var results = {};

  for (var c = 0; c < customers.length; c++) {
    var cust = customers[c];
    var custId = cust.customer_id;
    var companyName = cust.company_name;

    try {
      var customerFolder = findCustomerUploadFolder(companyName);
      if (!customerFolder) {
        results[custId] = {
          daten_erhalten: false,
          file_count: 0,
          last_upload_date: null,
          files: [],
          folder_found: false,
          is_overdue: isOverdue,
          current_month: currentMonth,
        };
        continue;
      }

      // Look for files in the customer folder (or month-subfolder)
      var monthFolder = findMonthSubfolder(customerFolder, currentMonth);
      var targetFolder = monthFolder || customerFolder;

      var fileInfos = [];
      var latestDate = null;
      var filesIter = targetFolder.getFiles();

      while (filesIter.hasNext()) {
        var file = filesIter.next();
        var lastUpdated = file.getLastUpdated();
        var fileMonth = Utilities.formatDate(lastUpdated, 'Europe/Berlin', 'yyyy-MM');

        // Only count files from the current month (if no month subfolder)
        if (!monthFolder && fileMonth !== currentMonth) continue;

        var info = {
          name: file.getName(),
          size: formatFileSize(file.getSize()),
          date: lastUpdated.toISOString(),
          mimeType: file.getMimeType(),
        };
        fileInfos.push(info);

        if (!latestDate || lastUpdated > latestDate) {
          latestDate = lastUpdated;
        }
      }

      results[custId] = {
        daten_erhalten: fileInfos.length > 0,
        file_count: fileInfos.length,
        last_upload_date: latestDate ? latestDate.toISOString() : null,
        files: fileInfos,
        folder_found: true,
        is_overdue: isOverdue && fileInfos.length === 0,
        current_month: currentMonth,
      };

    } catch (err) {
      Logger.log('Error checking uploads for ' + companyName + ': ' + err.message);
      results[custId] = {
        daten_erhalten: false,
        file_count: 0,
        last_upload_date: null,
        files: [],
        folder_found: false,
        error: err.message,
        is_overdue: isOverdue,
        current_month: currentMonth,
      };
    }
  }

  return { data: results, checked_at: new Date().toISOString() };
}

// ── VALIDATE DATA: Check completeness of uploaded files ──
// Validates that expected file types (BWA, SuSa) are present
function handleValidateData(payload) {
  var customers = payload.customers || [];
  var now = new Date();
  var currentMonth = Utilities.formatDate(now, 'Europe/Berlin', 'yyyy-MM');
  var results = {};

  for (var c = 0; c < customers.length; c++) {
    var cust = customers[c];
    var custId = cust.customer_id;
    var companyName = cust.company_name;

    try {
      var customerFolder = findCustomerUploadFolder(companyName);
      if (!customerFolder) {
        results[custId] = {
          daten_valide: false,
          missing_files: EXPECTED_FILES.slice(),
          issues: ['Kein Upload-Ordner gefunden'],
        };
        continue;
      }

      var monthFolder = findMonthSubfolder(customerFolder, currentMonth);
      var targetFolder = monthFolder || customerFolder;

      // Collect filenames from the current month
      var fileNames = [];
      var filesIter = targetFolder.getFiles();
      while (filesIter.hasNext()) {
        var file = filesIter.next();
        var lastUpdated = file.getLastUpdated();
        var fileMonth = Utilities.formatDate(lastUpdated, 'Europe/Berlin', 'yyyy-MM');
        if (!monthFolder && fileMonth !== currentMonth) continue;
        fileNames.push(file.getName());
      }

      // Check which expected files are present
      var missing = [];
      var issues = [];
      for (var i = 0; i < EXPECTED_FILES.length; i++) {
        var expected = EXPECTED_FILES[i];
        var found = false;
        for (var j = 0; j < fileNames.length; j++) {
          if (fileNames[j].indexOf(expected) !== -1) {
            found = true;
            break;
          }
        }
        if (!found) {
          missing.push(expected);
        }
      }

      if (fileNames.length === 0) {
        issues.push('Keine Dateien hochgeladen');
      } else if (missing.length > 0) {
        issues.push('Fehlende Dateien: ' + missing.join(', '));
      }

      // Check file sizes (warn on very small files < 1KB)
      filesIter = targetFolder.getFiles();
      while (filesIter.hasNext()) {
        var f = filesIter.next();
        if (f.getSize() < 1024) {
          issues.push('Verdächtig kleine Datei: ' + f.getName());
        }
      }

      results[custId] = {
        daten_valide: missing.length === 0 && fileNames.length > 0,
        missing_files: missing,
        issues: issues,
        checked_files: fileNames.length,
      };

    } catch (err) {
      results[custId] = {
        daten_valide: false,
        missing_files: EXPECTED_FILES.slice(),
        issues: ['Fehler: ' + err.message],
      };
    }
  }

  return { data: results, validated_at: new Date().toISOString() };
}

// ── Helper: Find customer upload folder ─────────────────
function findCustomerUploadFolder(companyName) {
  // Strategy 1: Dedicated upload root folder (KUNDEN_UPLOAD_FOLDER)
  if (KUNDEN_UPLOAD_FOLDER) {
    try {
      var uploadRoot = DriveApp.getFolderById(KUNDEN_UPLOAD_FOLDER);
      var folders = uploadRoot.getFoldersByName(companyName);
      if (folders.hasNext()) return folders.next();

      // Try partial match (company name might differ slightly)
      folders = uploadRoot.getFolders();
      while (folders.hasNext()) {
        var f = folders.next();
        if (f.getName().indexOf(companyName) !== -1 || companyName.indexOf(f.getName()) !== -1) {
          return f;
        }
      }
    } catch (err) {
      Logger.log('Error accessing KUNDEN_UPLOAD_FOLDER: ' + err.message);
    }
  }

  // Strategy 2: Look in DRIVE_FOLDER_ID / 04_Datenupload / [Kundenname]
  try {
    var root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var datenupload = root.getFoldersByName('04_Datenupload');
    if (datenupload.hasNext()) {
      var uploadDir = datenupload.next();
      var custFolders = uploadDir.getFoldersByName(companyName);
      if (custFolders.hasNext()) return custFolders.next();

      // Partial match
      custFolders = uploadDir.getFolders();
      while (custFolders.hasNext()) {
        var cf = custFolders.next();
        if (cf.getName().indexOf(companyName) !== -1 || companyName.indexOf(cf.getName()) !== -1) {
          return cf;
        }
      }
    }
  } catch (err) {
    Logger.log('Error in Strategy 2: ' + err.message);
  }

  return null;
}

// ── Helper: Find month-specific subfolder (YYYY-MM) ─────
function findMonthSubfolder(parentFolder, monthStr) {
  try {
    var folders = parentFolder.getFoldersByName(monthStr);
    if (folders.hasNext()) return folders.next();

    // Also try German month names like "2026-04 April"
    folders = parentFolder.getFolders();
    while (folders.hasNext()) {
      var f = folders.next();
      if (f.getName().indexOf(monthStr) !== -1) return f;
    }
  } catch (err) {
    // No month subfolder found
  }
  return null;
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

// ============================================================
// MANDATE SYNC – Liest alle Dienstleistungsverträge aus Drive
// Seite 2: "Jetzt synchronisieren" ruft diese Funktion auf
// ============================================================

function syncMandates() {
  var results = [];
  var errors  = [];

  try {
    var kundenFolder = DriveApp.getFolderById(KUNDEN_FOLDER_ID);
    var customerFolders = kundenFolder.getFolders();

    while (customerFolders.hasNext()) {
      var customerFolder = customerFolders.next();
      var folderName = customerFolder.getName();

      try {
        // 02_VERTRAG Unterordner suchen
        var vertragFolders = customerFolder.getFoldersByName('02_VERTRAG');
        if (!vertragFolders.hasNext()) {
          errors.push({ folder: folderName, error: '02_VERTRAG Unterordner nicht gefunden' });
          continue;
        }

        var vertragFolder = vertragFolders.next();
        var contractData  = findAndParseContract(vertragFolder, folderName);

        if (contractData) {
          results.push(contractData);
        } else {
          errors.push({ folder: folderName, error: 'Kein Dienstleistungsvertrag gefunden' });
        }
      } catch (folderErr) {
        errors.push({ folder: folderName, error: folderErr.toString() });
      }
    }
  } catch (mainErr) {
    return { success: false, error: mainErr.toString() };
  }

  return {
    success:    true,
    synced_at:  new Date().toISOString(),
    count:      results.length,
    data:       results,
    errors:     errors,
  };
}

// ── Findet und parsed den Dienstleistungsvertrag im Ordner ───
function findAndParseContract(vertragFolder, folderName) {
  var files = vertragFolder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName().toLowerCase();

    // Nur Dienstleistungsvertrag – keine Anlagen
    if (
      name.indexOf('dienstleistungsvertrag') !== -1 &&
      name.indexOf('anlage')   === -1 &&
      name.indexOf('avv')      === -1 &&
      name.indexOf('tom')      === -1
    ) {
      try {
        var text = extractTextFromFile(file);
        if (text) {
          return parseContractText(text, folderName, file.getId(), file.getName());
        }
      } catch (parseErr) {
        Logger.log('Parse-Fehler für ' + file.getName() + ': ' + parseErr);
      }
    }
  }
  return null;
}

// ── Text aus Datei lesen (.docx oder Google Doc) ─────────────
function extractTextFromFile(file) {
  var mimeType = file.getMimeType();

  // Nativer Google Doc
  if (mimeType === 'application/vnd.google-apps.document') {
    return DocumentApp.openById(file.getId()).getBody().getText();
  }

  // .docx / .doc → temporär in Google Doc konvertieren, lesen, löschen
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    var tempFile = Drive.Files.copy(
      { mimeType: 'application/vnd.google-apps.document', title: '_TEMP_' + file.getName() },
      file.getId()
    );
    try {
      var text = DocumentApp.openById(tempFile.id).getBody().getText();
      Drive.Files.remove(tempFile.id);
      return text;
    } catch (e) {
      try { Drive.Files.remove(tempFile.id); } catch (_) {}
      throw e;
    }
  }

  return null;
}

// ── Extraktion der Vertragsdaten aus dem Rohtext ─────────────
function parseContractText(text, folderName, fileId, fileName) {

  // DD.MM.YYYY → YYYY-MM-DD
  function toIsoDate(str) {
    if (!str) return null;
    var m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return null;
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }

  // "4.500,00" → 4500
  function parseEuro(str) {
    if (!str) return null;
    var n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  // ── Firmenname ──────────────────────────────────────────────
  var companyName = null;
  var cpPatterns = [
    /Auftraggeber[:\s]+([^\n,]+(?:GmbH|AG|KG|GbR|e\.K\.|OHG|UG|SE|eG)[^\n,]*)/i,
    /zwischen\s+(?:der\s+)?([^\n,]+(?:GmbH|AG|KG|GbR|e\.K\.|OHG|UG|SE|eG)[^\n,]*)/i,
    /Kunde[:\s]+([^\n]+(?:GmbH|AG|KG|GbR|e\.K\.|OHG|UG|SE|eG)[^\n]*)/i,
  ];
  for (var i = 0; i < cpPatterns.length; i++) {
    var m = text.match(cpPatterns[i]);
    if (m) { companyName = m[1].trim(); break; }
  }
  if (!companyName) companyName = folderName.replace(/_/g, ' ');

  // ── Ansprechpartner ─────────────────────────────────────────
  var ansprechpartner = null;
  var apPatterns = [
    /vertreten durch\s+([^\n,]+)/i,
    /Ansprechpartner[:\s]+([^\n]+)/i,
    /Geschäftsführer[:\s]+([^\n,]+)/i,
    /(?:Herr|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/,
  ];
  for (var j = 0; j < apPatterns.length; j++) {
    var ap = text.match(apPatterns[j]);
    if (ap) { ansprechpartner = ap[1].trim().replace(/,$/, ''); break; }
  }

  // ── E-Mail (erste Nicht-Meyer-Decision Adresse) ─────────────
  var email = null;
  var emailMatches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  for (var k = 0; k < emailMatches.length; k++) {
    if (emailMatches[k].indexOf('meyerdecision.com') === -1 &&
        emailMatches[k].indexOf('gmail.com') === -1) {
      email = emailMatches[k];
      break;
    }
  }

  // ── Vertragsbeginn ──────────────────────────────────────────
  var vertragsbeginn = null;
  var beginPatterns = [
    /(?:Vertragsbeginn|Leistungsbeginn|Beginn der Laufzeit|beginnt am|ab dem|gültig ab)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
    /§\s*\d+[^§]{0,200}?(?:Beginn|Laufzeit)[^§]{0,100}?(\d{1,2}\.\d{1,2}\.\d{4})/i,
  ];
  for (var b = 0; b < beginPatterns.length; b++) {
    var bm = text.match(beginPatterns[b]);
    if (bm) { vertragsbeginn = toIsoDate(bm[1]); break; }
  }

  // ── Vertragsende ────────────────────────────────────────────
  var vertragsende = null;
  var unbefristet = /unbefristet|auf unbestimmte Zeit|ohne feste Laufzeit/i.test(text);

  if (!unbefristet) {
    var endPatterns = [
      /(?:Vertragsende|Laufzeitende|bis zum|endet am|gültig bis)\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
      /Laufzeit[^.]{0,100}?bis\s+(?:zum\s+)?(\d{1,2}\.\d{1,2}\.\d{4})/i,
    ];
    for (var e = 0; e < endPatterns.length; e++) {
      var em = text.match(endPatterns[e]);
      if (em) { vertragsende = toIsoDate(em[1]); break; }
    }

    // Laufzeit in Monaten → Enddatum berechnen
    if (!vertragsende && vertragsbeginn) {
      var lzMatch = text.match(/Laufzeit\s*(?:von\s*)?(\d+)\s*Monate?/i);
      if (lzMatch) {
        var months = parseInt(lzMatch[1]);
        var start  = new Date(vertragsbeginn);
        start.setMonth(start.getMonth() + months);
        vertragsende = start.toISOString().split('T')[0];
      }
    }
  }

  // ── Monatliches Honorar ─────────────────────────────────────
  var honorar = null;
  var honorarPatterns = [
    /(?:monatliche[sr]?\s+)?(?:Honorar|Vergütung|Pauschalhonorar)\s*(?:von|beträgt|:)?\s*(?:EUR|€)?\s*(\d[\d.,]+)\s*(?:EUR|€)/i,
    /(\d[\d.,]+)\s*(?:EUR|€)\s*(?:pro|je|\/)\s*(?:Monat|m\.)/i,
    /(?:EUR|€)\s*(\d[\d.,]+)\s*(?:pro|je|\/)\s*(?:Monat|m\.)/i,
  ];
  for (var h = 0; h < honorarPatterns.length; h++) {
    var hm = text.match(honorarPatterns[h]);
    if (hm) {
      var val = parseEuro(hm[1]);
      if (val && val > 100) { honorar = val; break; }
    }
  }

  // ── Setup-Fee ───────────────────────────────────────────────
  var setupFee = null;
  var setupPatterns = [
    /(?:Einrichtungs|Setup|Onboarding|Implementierungs)[^\n.]{0,80}?(\d[\d.,]+)\s*(?:EUR|€)/i,
    /einmalig[^\n.]{0,80}?(\d[\d.,]+)\s*(?:EUR|€)/i,
  ];
  for (var s = 0; s < setupPatterns.length; s++) {
    var sm = text.match(setupPatterns[s]);
    if (sm) {
      var sv = parseEuro(sm[1]);
      if (sv && sv > 100) { setupFee = sv; break; }
    }
  }

  // ── Dienstleistung ──────────────────────────────────────────
  var dienstleistung = null;
  var dlPatterns = [
    /(?:Leistungsgegenstand|Gegenstand der Leistung)[:\s]+([^\n.]{10,120})/i,
    /erbringt folgende Leistungen?[:\s]+([^\n.]{10,120})/i,
    /(Advisory[^\n.]{0,80})/i,
  ];
  for (var d = 0; d < dlPatterns.length; d++) {
    var dm = text.match(dlPatterns[d]);
    if (dm) { dienstleistung = (dm[1] || dm[0]).trim().substring(0, 100); break; }
  }

  return {
    customer_id:             'DRIVE-' + folderName.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
    company_name:            companyName,
    ansprechpartner:         ansprechpartner || '',
    emails:                  email ? [email] : [],
    vertragsbeginn:          vertragsbeginn,
    vertragsende:            vertragsende,
    monatliches_honorar:     honorar,
    setup_fee:               setupFee,
    gebuchte_dienstleistung: dienstleistung || 'Advisory',
    mandate_status:          vertragsbeginn ? 'active' : 'onboarding',
    notes:                   '',
    source_file:             fileName,
    source_file_id:          fileId,
    last_auto_sync:          new Date().toISOString(),
    manually_edited:         false,
    vertragsart:             'dienstleistungsvertrag',
  };
}

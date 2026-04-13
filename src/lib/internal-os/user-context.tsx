'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface UserContextType {
  currentUser: string;
  setCurrentUser: (user: string) => void;
  currentUserName: string;
}

const UserContext = createContext<UserContextType>({
  currentUser: 'gregory@meyerdecision.com',
  setCurrentUser: () => {},
  currentUserName: 'Gregory Meyer',
});

const USER_NAMES: Record<string, string> = {
  'gregory@meyerdecision.com': 'Gregory Meyer',
  'nhi@meyerdecision.com': 'Nhi Meyer',
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState('gregory@meyerdecision.com');

  return (
    <UserContext.Provider value={{
      currentUser,
      setCurrentUser,
      currentUserName: USER_NAMES[currentUser] || currentUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}

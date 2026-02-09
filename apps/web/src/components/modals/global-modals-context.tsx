"use client";

import { createContext, useContext, useState } from "react";

import LogoutModal from "./logout-modal";

interface GlobalModalsContextType {
  showLogoutModal: (email: string) => void;
  hideLogoutModal: () => void;
}

const GlobalModalsContext = createContext<GlobalModalsContextType>({
  showLogoutModal: () => {},
  hideLogoutModal: () => {},
});

export function GlobalModalsContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState<string>("");
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const showLogoutModal = (email: string) => {
    setEmail(email);
    setLogoutModalOpen(true);
  };

  const hideLogoutModal = () => {
    setLogoutModalOpen(false);
  };

  const value: GlobalModalsContextType = {
    showLogoutModal,
    hideLogoutModal,
  };

  return (
    <GlobalModalsContext.Provider value={value}>
      <LogoutModal
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        email={email}
      />
      {children}
    </GlobalModalsContext.Provider>
  );
}

export function useGlobalModalsContext() {
  const context = useContext(GlobalModalsContext);

  if (!context) {
    throw new Error(
      "useGlobalModalsContext must be used within a GlobalModalsContextProvider",
    );
  }

  return context;
}

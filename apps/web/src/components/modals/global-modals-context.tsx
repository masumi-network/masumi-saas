"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

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
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/signin" || pathname === "/admin/signin") {
      setLogoutModalOpen(false);
    }
  }, [pathname]);

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

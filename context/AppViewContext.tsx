import React, { createContext, useContext, useState } from "react";

type ViewType = "patient" | "caregiver" | null;

interface AppViewContextType {
  view: ViewType;
  setView: (view: ViewType) => void;
}

const AppViewContext = createContext<AppViewContextType>({
  view: null,
  setView: () => {},
});

export const AppViewProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [view, setView] = useState<ViewType>(null);

  return (
    <AppViewContext.Provider value={{ view, setView }}>
      {children}
    </AppViewContext.Provider>
  );
};

export const useAppView = () => useContext(AppViewContext);

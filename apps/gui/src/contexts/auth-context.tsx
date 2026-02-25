import { createContext, useContext } from "react";

type AuthContextValue = {
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false
});

export const AuthProvider = AuthContext.Provider;

export const useAuth = () => useContext(AuthContext);

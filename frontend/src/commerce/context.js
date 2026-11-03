import { createContext, useContext } from "react";

export const CommerceContext = createContext(null);
export function useCommerce() { return useContext(CommerceContext); }

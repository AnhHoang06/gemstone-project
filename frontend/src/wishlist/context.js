import { createContext, useContext } from "react";

export const WishlistContext = createContext(null);
export function useWishlist() { return useContext(WishlistContext); }

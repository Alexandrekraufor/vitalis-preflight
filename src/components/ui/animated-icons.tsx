"use client";

import { motion } from "framer-motion";

export function DashboardAnimatedIcon({ active }: { readonly active: boolean }) {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {/* 4 squares that come together on hover or active */}
      <motion.rect
        width="7"
        height="9"
        rx="1"
        initial={false}
        animate={{ x: active ? 3 : 1, y: active ? 3 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.rect
        width="7"
        height="5"
        rx="1"
        initial={false}
        animate={{ x: active ? 14 : 16, y: active ? 3 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.rect
        width="7"
        height="9"
        rx="1"
        initial={false}
        animate={{ x: active ? 14 : 16, y: active ? 12 : 14 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.rect
        width="7"
        height="5"
        rx="1"
        initial={false}
        animate={{ x: active ? 3 : 1, y: active ? 16 : 18 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </motion.svg>
  );
}

export function PlugAnimatedIcon({ active }: { readonly active: boolean }) {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {/* Plug pushes down into the socket */}
      <motion.g
        initial={false}
        animate={{ y: active ? 2 : -2 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <path d="M12 22v-5" />
        <path d="M9 8V2" />
        <path d="M15 8V2" />
        <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
      </motion.g>
    </motion.svg>
  );
}

export function UsersAnimatedIcon({ active }: { readonly active: boolean }) {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <motion.path 
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" 
        initial={false}
        animate={{ y: active ? 0 : 2, opacity: active ? 1 : 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.circle 
        cx="9" cy="7" r="4" 
        initial={false}
        animate={{ scale: active ? 1 : 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.path 
        d="M22 21v-2a4 4 0 0 0-3-3.87" 
        initial={false}
        animate={{ x: active ? 0 : 2, opacity: active ? 1 : 0.5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <motion.path 
        d="M16 3.13a4 4 0 0 1 0 7.75" 
        initial={false}
        animate={{ x: active ? 0 : 2, opacity: active ? 1 : 0.5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </motion.svg>
  );
}

export function GenericAnimatedIcon({ 
  active, 
  children,
  scale = true
}: { 
  readonly active: boolean, 
  readonly children: React.ReactNode,
  readonly scale?: boolean 
}) {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      initial={false}
      animate={{ scale: scale && active ? 1.1 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.svg>
  );
}

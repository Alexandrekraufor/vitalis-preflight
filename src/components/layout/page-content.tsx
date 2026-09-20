import type { ReactNode } from "react";

/**
 * The scrolling body of a screen, under the pinned header.
 *
 * Every page shares one column width and one vertical rhythm from here, so a
 * screen cannot drift a few pixels off from the next one.
 */
export function PageContent({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-5 px-5 pb-14 pt-5 md:px-8">
      {children}
    </div>
  );
}

"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
};

export function ActionSubmitButton({ children, pendingLabel, className }: Props) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "RisqLab 80 Index",
};

export default function IndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

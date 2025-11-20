import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Index Methodology | RisqLab",
};

export default function IndexMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

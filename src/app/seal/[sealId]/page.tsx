import { notFound } from "next/navigation";
import { isHex } from "viem";

import { SealRecordPage } from "@/components/seal-record-lookup";

export default async function SealPage({
  params,
}: {
  params: Promise<{ sealId: string }>;
}) {
  const { sealId } = await params;
  if (!isHex(sealId, { strict: true }) || sealId.length !== 66) notFound();

  return <SealRecordPage sealId={sealId} />;
}

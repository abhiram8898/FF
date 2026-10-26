"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLookups } from "@/lib/store";
import { Empty, linkCls } from "@/components/ui";
import { EnquiryForm } from "@/components/EnquiryForm";

export default function EditEnquiryPage() {
  const { id } = useParams<{ id: string }>();
  const { enquiry } = useLookups();
  const enq = enquiry(id);
  if (!enq) {
    return <Empty action={<Link href="/enquiries" className={linkCls}>Back to Enquiries</Link>}>This enquiry doesn&apos;t exist.</Empty>;
  }
  return <EnquiryForm key={enq.id} existing={enq} />;
}

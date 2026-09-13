import type { ReactNode } from "react";

import { Html } from "@react-three/drei";

type SegmentDetailProps = {
  children?: ReactNode;
};

export function SegmentDetail({ children }: SegmentDetailProps) {
  return <Html center>{children}</Html>;
}

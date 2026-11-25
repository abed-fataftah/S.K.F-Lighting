"use client";

import Image from "next/image";
import { colourLoader } from "@/image-loader";
import { cn } from "@/lib/utils";

/**
 * The fill behind a whole product photo (scope feature 44): the photo's own average colour, one
 * pixel from Supabase stretched over the frame. A tall bulb on an orange wall gets orange beside
 * it instead of dark bars. Place it first inside a positioned frame, before the contained photo.
 * The frame keeps `bg-product-1` underneath, shown until this pixel arrives.
 */
export function PhotoColour({
  imageKey,
  className,
}: {
  readonly imageKey: string;
  readonly className?: string;
}) {
  return (
    <Image
      src={imageKey}
      loader={colourLoader}
      alt=""
      fill
      sizes="1px"
      draggable={false}
      data-testid="photo-colour"
      className={cn("pointer-events-none", className)}
    />
  );
}

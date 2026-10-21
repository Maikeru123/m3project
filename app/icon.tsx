import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

/* eslint-disable @next/next/no-img-element */

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default async function Icon() {
  const logo = await readFile(path.join(process.cwd(), "public", "NGOBIA.png"))
  const logoUrl = `data:image/png;base64,${logo.toString("base64")}`

  return new ImageResponse(
    <div
      style={{
        width: 64,
        height: 64,
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <img
        src={logoUrl}
        alt="NGOBIA N"
        width={282}
        height={94}
        style={{ position: "absolute", left: -16, top: -13 }}
      />
    </div>,
    size
  )
}

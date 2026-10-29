import { ImageResponse } from "next/og"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 64,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        background: "#b4232c",
        color: "#fff",
        fontSize: 25,
        fontWeight: 700,
      }}
    >
      DB
    </div>,
    size
  )
}

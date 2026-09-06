import { stickerFor } from "../lib/stickers.js";

// Titulo de evento con su pegatina delante, si el titulo la sugiere.
export default function EventTitle({ title }) {
  const sticker = stickerFor(title);
  return (
    <>
      {sticker && <span className="sticker" aria-hidden="true">{sticker}</span>}
      {title}
    </>
  );
}

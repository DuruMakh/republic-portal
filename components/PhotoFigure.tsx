import Image from "next/image";

export interface PhotoFigureProps {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

export function PhotoFigure({ src, alt, caption, width, height }: PhotoFigureProps) {
  return (
    <figure>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="border border-hairline"
      />
      {caption && (
        <figcaption className="text-[0.74rem] text-muted-fg mt-1.5 border-b border-hairline pb-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

import { parseBody } from '@/lib/utils';

/** Renders article / biography text with an editorial layout. Plain text only: no HTML is ever injected. */
export function ArticleBody({ body }: { body: string }) {
  const blocks = parseBody(body);
  const firstParagraph = blocks.findIndex((b) => b.t === 'p');
  return (
    <div className="prose-ar">
      {blocks.map((b, i) => {
        if (b.t === 'h2') return <h2 key={i}>{b.text}</h2>;
        if (b.t === 'h3') return <h3 key={i}>{b.text}</h3>;
        if (b.t === 'quote') return <blockquote key={i} className="gold-text">{b.text}</blockquote>;
        return (
          <p key={i} className={i === firstParagraph ? 'lead' : undefined}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

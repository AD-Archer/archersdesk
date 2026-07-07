"use client";

import { useState } from "react";
import { useNow } from "../hooks";
import type { WidgetProps } from "./registry";

const QUOTES: Array<{ t: string; a: string }> = [
  { t: "The days are long, but the years are short.", a: "Gretchen Rubin" },
  { t: "We are what we repeatedly do.", a: "Will Durant" },
  { t: "Simplicity is the ultimate sophistication.", a: "attr. Leonardo da Vinci" },
  { t: "It is not that we have a short time to live, but that we waste a lot of it.", a: "Seneca" },
  { t: "Whatever you are, be a good one.", a: "attr. Abraham Lincoln" },
  { t: "The best way out is always through.", a: "Robert Frost" },
  { t: "Attention is the rarest and purest form of generosity.", a: "Simone Weil" },
  { t: "There is no substitute for hard work.", a: "Thomas Edison" },
  { t: "Everything you can imagine is real.", a: "Pablo Picasso" },
  { t: "Make it simple, but significant.", a: "Don Draper" },
  { t: "The obstacle is the way.", a: "Marcus Aurelius" },
  { t: "Slow is smooth, smooth is fast.", a: "proverb" },
  { t: "A year from now you may wish you had started today.", a: "Karen Lamb" },
  { t: "How we spend our days is, of course, how we spend our lives.", a: "Annie Dillard" },
  { t: "The details are not the details. They make the design.", a: "Charles Eames" },
  { t: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", a: "Stephen King" },
  { t: "You can't use up creativity. The more you use, the more you have.", a: "Maya Angelou" },
  { t: "What we do every day matters more than what we do once in a while.", a: "Gretchen Rubin" },
  { t: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", a: "Antoine de Saint-Exupéry" },
  { t: "Music is the space between the notes.", a: "Claude Debussy" },
  { t: "Rest is not idleness.", a: "John Lubbock" },
  { t: "The impediment to action advances action.", a: "Marcus Aurelius" },
  { t: "Do the best you can until you know better. Then when you know better, do better.", a: "Maya Angelou" },
  { t: "Nothing will work unless you do.", a: "Maya Angelou" },
  { t: "The secret of getting ahead is getting started.", a: "attr. Mark Twain" },
  { t: "Well begun is half done.", a: "Aristotle" },
  { t: "Little by little, one travels far.", a: "proverb" },
  { t: "The quieter you become, the more you can hear.", a: "Ram Dass" },
];

export function QuoteWidget(_: WidgetProps) {
  const now = useNow(60_000);
  const [offset, setOffset] = useState(0);
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const q = QUOTES[(dayOfYear + offset) % QUOTES.length];

  return (
    <>
      <span className="w-label">a line a day</span>
      <div className="w-body">
        <button className="qt" onClick={() => setOffset((o) => o + 1)} aria-label="next quote">
          <span className="qt-mark">&ldquo;</span>
          <div className="qt-text">{q.t}</div>
          <div className="qt-author">{q.a}</div>
        </button>
      </div>
    </>
  );
}

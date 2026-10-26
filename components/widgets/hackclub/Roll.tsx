"use client";

// A figure that rolls into place like an odometer, for stern's cards: each
// digit is a wheel of 0 to 9 that turns up from 0 when the figure first
// shows, one after the next from the left, and settles with a little bounce,
// in the round face hack club sets its numbers in. When the figure changes,
// each wheel turns from where it was to where it's going, so a moving number
// shows which digits moved. Anything that isn't a digit ($, the comma, k, %)
// just sits still. Pure css (hackclub.css), so reduced motion just shows it.

import type { CSSProperties } from "react";

/** 0 to 9 and round to 0 again, so a 9 bouncing past itself shows the next
 *  digit, not a blank, the way a real wheel would. */
const WHEEL = [..."01234567890"];

export function Roll({ text }: { text: string }) {
  const chars = [...text];
  let digit = 0;
  return (
    <span className="roll" aria-label={text}>
      {chars.map((c, i) => {
        // keyed from the right, so "999" becoming "1,000" keeps its ones on the ones wheel
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={key} aria-hidden>
              {c}
            </span>
          );
        const style = { "--d": Number(c), "--i": digit++ } as CSSProperties;
        return (
          <span key={key} className="roll-wheel" aria-hidden>
            <span className="roll-window">
              <span className="roll-digits" style={style}>
                {WHEEL.map((w, j) => (
                  <span key={j}>{w}</span>
                ))}
              </span>
            </span>
            {/* holds the wheel's width to the digit it shows */}
            <span className="roll-sizer">{c}</span>
          </span>
        );
      })}
    </span>
  );
}

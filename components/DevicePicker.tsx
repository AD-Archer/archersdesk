"use client";

import { useState } from "react";
import type { Device } from "@/lib/types";
import { MI } from "./widgets/kit";

// Shown when a browser hasn't resolved which device it is (multiple devices
// exist, or its stored id was deleted elsewhere). Never auto-creates.
// iOS Settings style: large title, inset grouped lists, one blue button.

export default function DevicePicker({
  devices,
  onChoose,
  onCreate,
}: {
  devices: Device[];
  onChoose: (id: string) => void; // an existing device id, or "remote"
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="device-picker">
      <div className="pick-page">
        <div className="pick-intro">
          <h1 className="large-title">Which screen is this?</h1>
          <p className="pick-sub">Tap its name. You can change this later in Settings.</p>

          <div className="group pick-remote">
            <button className="group-row pick-row" onClick={() => onChoose("remote")}>
              <span className="pick-tile blue">
                <MI name="smartphone" />
              </span>
              <span className="pick-name">
                Use this phone as a remote
                <small>Control your screens from here</small>
              </span>
              <MI name="chevron_right" className="pick-chev" />
            </button>
          </div>
        </div>

        <div className="pick-lists">
          <div className="group-head">Screens</div>
          <div className="group">
            {devices.map((d) => (
              <button key={d.id} className="group-row pick-row" onClick={() => onChoose(d.id)}>
                <span className="pick-tile green">
                  <MI name="tv" />
                </span>
                <span className="pick-name">{d.name}</span>
                <MI name="chevron_right" className="pick-chev" />
              </button>
            ))}
          </div>

          <form
            className="pick-new"
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (n) onCreate(n);
            }}
          >
            <label className="group-head" htmlFor="pick-new-name">
              Or add a new screen
            </label>
            <div className="pick-new-row">
              <input
                id="pick-new-name"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name, like Kitchen"
                maxLength={40}
              />
              <button className="btn-primary" type="submit" disabled={!name.trim()}>
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Device } from "@/lib/types";

// Shown when a browser hasn't resolved which device it is (multiple devices
// exist, or its stored id was deleted elsewhere). Never auto-creates.

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
      <div className="dp-card">
        <h1>Which device is this?</h1>
        <p>Pick how this screen behaves. You can change it later in settings.</p>
        <div className="dp-list">
          {devices.map((d) => (
            <button key={d.id} className="dp-item" onClick={() => onChoose(d.id)}>
              <b>{d.name}</b>
              <small>display</small>
            </button>
          ))}
          <button className="dp-item dp-remote" onClick={() => onChoose("remote")}>
            <b>Remote</b>
            <small>control the other devices from here</small>
          </button>
        </div>
        <form
          className="dp-create"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (n) onCreate(n);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new device name"
            maxLength={40}
          />
          <button type="submit" disabled={!name.trim()}>
            create
          </button>
        </form>
      </div>
    </div>
  );
}

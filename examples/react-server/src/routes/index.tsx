import React from "react";
import { ClientComponent } from "./_client";

export function Root() {
  return (
    <div>
      <h4>Hello react server</h4>
      <ClientComponent />
    </div>
  );
}

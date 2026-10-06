"""Native Windows launcher for the packaged Plutus desktop application."""

from __future__ import annotations

import threading
from pathlib import Path

import webview

from server import APP_ROOT, PORT, create_server


URL = f"http://127.0.0.1:{PORT}"


class PlutusDesktop:
    """Run the private local API behind an embedded desktop web view."""

    def __init__(self) -> None:
        self.server = create_server()
        self.server_thread = threading.Thread(
            target=self.server.serve_forever,
            name="plutus-server",
            daemon=True,
        )
        self.closed = False

    def stop(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.server.shutdown()
        self.server.server_close()

    def run(self) -> None:
        self.server_thread.start()
        window = webview.create_window(
            "Plutus",
            URL,
            width=1280,
            height=800,
            min_size=(900, 600),
            background_color="#09090b",
            text_select=True,
        )
        window.events.closed += self.stop

        # WebView2 gives Plutus its own native window without browser chrome.
        # A dedicated data directory prevents it from sharing browser profiles.
        storage_path = Path(APP_ROOT) / ".desktop"
        try:
            webview.start(
                gui="edgechromium",
                private_mode=False,
                storage_path=str(storage_path),
            )
        finally:
            self.stop()


if __name__ == "__main__":
    PlutusDesktop().run()

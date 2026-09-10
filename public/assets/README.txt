Drop your own art here (all optional - everything has a built-in fallback):

  flying.gif   -> shown while the rocket is climbing (round "running")
  crashed.gif  -> shown for a few seconds right after the crash
  star.png     -> used everywhere a Stars balance/amount is shown

If flying.gif/crashed.gif are missing, the app falls back to a simple
built-in emoji animation. If star.png is missing, it falls back to a
crafted gold-gradient vector star icon instead of a platform emoji.

flying.gif and crashed.gif are rendered as CSS background-images (not
<img> tags) specifically so long-pressing them in Telegram's in-app
browser can't surface a "Copy Link"/"Open in..." menu exposing the raw
file URL.

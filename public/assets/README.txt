Drop your own art here (all optional - everything has a built-in fallback):

  flying.json   -> Lottie animation shown while the rocket is climbing
  crashed.json  -> Lottie animation shown for a few seconds after a crash
  error.json    -> Lottie animation shown if the app is opened outside Telegram
  star.png      -> used everywhere a Stars balance/amount is shown
  flying.gif    -> legacy fallback if flying.json is missing (optional)
  crashed.gif   -> legacy fallback if crashed.json is missing (optional)

Fallback order for the rocket/crash visuals: Lottie JSON -> GIF -> a small
built-in emoji animation. Nothing needs any of these files to work; you can
add them whenever you have real art ready.

flying.gif/crashed.gif (if used) are rendered as CSS background-images
(never <img> tags) specifically so long-pressing them in Telegram's in-app
browser can't surface a "Copy Link"/"Open in..." menu exposing the raw
file URL. Lottie animations render as inline SVG and have the same
protection by construction.

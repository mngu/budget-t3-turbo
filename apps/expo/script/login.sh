#!/bin/sh
# Signs Expo Go into the demo space, without an email: on the booted iOS simulator,
# or with `--phone` on a real phone, which gets the link through the clipboard.
# Needs `pnpm dev` (the server swaps the link for a session) and `pnpm mobile` running.
set -eu

host=127.0.0.1
[ "${1:-}" = "--phone" ] && host=$(ipconfig getifaddr en0)

link=$(pnpm -s db:seed | grep -o 'http[^ ]*/magic-link/verify[^ ]*')
callback="exp%3A%2F%2F$host%3A8081%2F--%2Fauth"
location=$(curl -fsS -o /dev/null -w '%{redirect_url}' "${link%%&callbackURL=*}&callbackURL=$callback")

case "$location" in
  exp://*) ;;
  *) echo "Le serveur n'a pas renvoyé vers Expo Go : ${location:-aucune redirection}. pnpm dev tourne-t-il ?" >&2; exit 1 ;;
esac

if [ "$host" = 127.0.0.1 ]; then
  xcrun simctl openurl booted "$location"
else
  printf %s "$location" | pbcopy
  # Expo Go drops the link's path when the link itself launches the project.
  echo "Lien copié. Ouvre d'abord l'app dans Expo Go, puis colle le lien dans Safari sur le téléphone (ou envoie-le-toi par AirDrop ou Messages)."
fi

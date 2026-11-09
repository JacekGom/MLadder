# Drabinka muzyczna (MLadder)

Aplikacja webowa (także na telefon): wysyłasz znajomemu zestaw 4, 8, 16 lub 32
piosenek ze Spotify, a on rozstrzyga w losowej drabince turniejowej, która jest
najlepsza.

Stos: Next.js (App Router, TypeScript), logowanie przez Spotify, baza Supabase,
hosting Vercel.

## Uruchomienie lokalne

1. **Spotify.** W [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   otwórz swoją aplikację, wejdź w *Settings* i:
   - w *Redirect URIs* dodaj `http://127.0.0.1:3000/api/auth/callback`
     (Spotify nie akceptuje już `localhost`),
   - zaznacz *Web API* i *Web Playback SDK*,
   - w *User Management* dodaj e-maile kont Spotify, które mają móc się
     logować (w trybie deweloperskim tylko one mają dostęp).
2. **Supabase.** Załóż projekt na [supabase.com](https://supabase.com), otwórz
   *SQL Editor* i uruchom po kolei zawartość plików z `supabase/migrations/`
   (`0001_init.sql`, `0002_ladder_functions.sql`, `0003_undo_vote.sql`).
   Adres i klucz *service_role* znajdziesz w *Project Settings → API*.
   (Bez Supabase logowanie też zadziała, tylko nic nie zostanie zapisane.)
3. **Zmienne.** Skopiuj `.env.example` do `.env.local` i uzupełnij.
4. **Start.**
   ```bash
   npm install
   npm run dev
   ```
   i otwórz <http://127.0.0.1:3000>.

## Publikacja na Vercel

1. Na [vercel.com](https://vercel.com) zaimportuj repozytorium.
2. W *Environment Variables* wpisz te same zmienne co w `.env.local`, z
   `SPOTIFY_REDIRECT_URI=https://<twoja-domena>.vercel.app/api/auth/callback`.
3. Ten sam adres dodaj w *Redirect URIs* aplikacji Spotify.

## Plan

1. Szkielet i logowanie przez Spotify ✅
2. Wysyłanie zestawu ✅ (top 50 z ostatniego miesiąca + wyszukiwarka, wybór 2^n
   piosenek, link dla odbiorcy)
3. Wypełnianie drabinki ✅ (losowe rozstawienie, pojedynki, opcjonalne
   odtwarzanie)
4. Wynik dla nadawcy i dopracowanie widoku na telefonie ✅

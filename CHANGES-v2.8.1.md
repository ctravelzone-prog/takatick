# TakaTick v2.8.1 — site serves APK v1.5

## Ki bodleche
- Dashboard-er Download link ekhon **TakaTickSMS-v1.5.apk** dey (age v1.4) — `server.js`-er `/download/app.apk` route + `public/dashboard.html`-er label, duitai bodleche।
- APK v1.5 (commit 30a1e97): foreground service + proti 2s inbox scan + notification (last payment dekhay) + reboot-er por auto-chalu + MainActivity-te BACKGROUND CHALU RAKHO button (battery-optimization exemption ek tap-e)। versionCode 6, md5 cca75573805eb4a67ce2403e7f4ae0f6, 20,907 bytes, same release keystore — v1.4-er upor update, setting/key thake।

## Keno
- Asol phone-e proman hoyeche v1.4-er broadcast background-e fire kore na: 11:43 + 11:45-er payment (Tk 14 DK898LNDZ9, Tk 20 DK898LPEWJ) 11:47-e server-e chilo na, 11:48-e app kholar por inbox scan pathiyeche। v1.5-er live test PASS: Tk 10 DK848M3KEM 11:59 PM-e background-e eseche, app na khulei।

## Deploy note
- Deploy-e Render-er ephemeral DB muche jay (ager motoi) — demo account notun kore banate hobe, app key bodle jabe, app-e notun key bosate hobe।
- Dashboard v1.5 serve korbe ei deploy-er por theke।

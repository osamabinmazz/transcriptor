// Abierta desde la PC (localhost) o por Tailscale (*.ts.net) hay PC; en cualquier otro sitio (GitHub Pages) es la versión web: solo online.
export const SOLO_ONLINE = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !location.hostname.endsWith('.ts.net');

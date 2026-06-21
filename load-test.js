import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp-up: Naikkan ke 50 user dalam 1 menit
    { duration: '3m', target: 50 },  // Stay: Tahan di 50 user selama 3 menit (untuk memicu HPA)
    { duration: '1m', target: 0 },   // Ramp-down: Turunkan ke 0 user dalam 1 menit
  ],
};

export default function () {
  // Menembak endpoint localhost yang sudah di-forward
  http.get('http://localhost:8080');
  sleep(0.1); // Jeda tipis antar request agar tidak menghancurkan network laptop
}
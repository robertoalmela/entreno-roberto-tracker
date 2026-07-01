# Entreno Roberto Tracker

PWA estática/offline para registrar entrenos de reinicio.

**Estado: v1.0** — terminada; solo mantenimiento según uso real.

App publicada: https://robertoalmela.github.io/entreno-roberto-tracker/

## Uso local

```bash
cd ~/Desktop/GitHub/00-active/entreno-roberto-tracker
python3 -m http.server 8787
```

Abrir: http://localhost:8787

## Funciones

- Día A torso y Día B pierna/full body precargados.
- Timer y duración de sesión.
- Registro por ejercicio: peso, reps, reps en recámara y técnica.
- Recomendación automática por semáforo: subir / repetir / bajar.
- Estadísticas básicas: sesiones, volumen, sets, último entreno.
- Exportación CSV y JSON.

## Regla de reinicio

Peso de 15, haces 10: elige un peso con el que podrías hacer unas 15 reps limpias, pero haces 10.

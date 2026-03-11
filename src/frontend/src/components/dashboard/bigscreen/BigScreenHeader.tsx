import { t } from '@lingui/core/macro';
import { Group, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { InvenTreeLogo } from '../../items/InvenTreeLogo';

type WeatherState = {
  temperature?: number;
  windSpeed?: number;
  label?: string;
  error?: string;
};

async function fetchWeather(): Promise<WeatherState> {
  // Shanghai default; we can make this configurable later.
  const latitude = 31.2304;
  const longitude = 121.4737;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,wind_speed_10m,weather_code');
  url.searchParams.set('timezone', 'auto');

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Weather request failed: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    current?: {
      temperature_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  };

  const temp = data.current?.temperature_2m;
  const wind = data.current?.wind_speed_10m;
  const code = data.current?.weather_code;

  return {
    temperature: typeof temp === 'number' ? temp : undefined,
    windSpeed: typeof wind === 'number' ? wind : undefined,
    label: typeof code === 'number' ? String(code) : undefined
  };
}

export function BigScreenHeader({ title }: Readonly<{ title: string }>) {
  const [now, setNow] = useState(() => dayjs());
  const [weather, setWeather] = useState<WeatherState>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const w = await fetchWeather();
        if (!cancelled) setWeather(w);
      } catch (err) {
        if (!cancelled) setWeather({ error: (err as Error).message });
      }
    }

    run();
    const timer = window.setInterval(run, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const weatherText = useMemo(() => {
    if (weather.error) return t`Weather: —`;
    const parts: string[] = [];
    if (typeof weather.temperature === 'number') parts.push(`${weather.temperature.toFixed(0)}°C`);
    if (typeof weather.windSpeed === 'number') parts.push(`${weather.windSpeed.toFixed(0)} m/s`);
    return parts.length ? `${t`Weather`}: ${parts.join(' / ')}` : t`Weather: —`;
  }, [weather]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        padding: '16px 24px 10px',
        position: 'relative'
      }}
    >
      <Group gap={10} wrap='nowrap'>
        <InvenTreeLogo />
        <Stack gap={0}>
          <Text c='cyan.2' fw={800} fz='md' lh={1.1}>
            {t`InvenTree`}
          </Text>
          <Text c='gray.5' size='xs'>
            {t`Operations`}
          </Text>
        </Stack>
      </Group>

      <Text c='cyan.3' fw={900} fz={22} style={{ letterSpacing: '0.04em', textAlign: 'center' }}>
        {title}
      </Text>

      <Stack gap={2} style={{ justifySelf: 'end', textAlign: 'right' }}>
        <Text c='gray.3' fw={700} size='sm'>
          {now.format('YYYY-MM-DD HH:mm:ss')}
        </Text>
        <Text c='gray.5' size='xs'>
          {weatherText}
        </Text>
      </Stack>

      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 0,
          height: 1,
          background:
            'linear-gradient(90deg, rgba(34, 211, 238, 0.05), rgba(34, 211, 238, 0.55), rgba(34, 211, 238, 0.05))'
        }}
      />
    </div>
  );
}

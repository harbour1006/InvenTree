import {
  Box,
  Group,
  Stack,
  Text,
  ThemeIcon,
  type MantineColor
} from '@mantine/core';
import type { ReactNode } from 'react';

export type BigScreenKpiItem = {
  label: string;
  value: string;
  description: string;
  color?: MantineColor;
  icon?: ReactNode;
};

export function BigScreenKpiRow({ items }: Readonly<{ items: BigScreenKpiItem[] }>) {
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
        gap: 14,
        minWidth: 0
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          style={{
            minHeight: 108,
            padding: 16,
            borderRadius: 16,
            border: '1px solid rgba(70, 168, 255, 0.25)',
            background:
              'linear-gradient(180deg, rgba(9, 30, 64, 0.95), rgba(5, 16, 38, 0.98))',
            boxShadow:
              'inset 0 0 0 1px rgba(30, 108, 194, 0.15), 0 10px 40px rgba(2, 8, 23, 0.35)',
            minWidth: 0
          }}
        >
          <Group justify='space-between' align='flex-start' wrap='nowrap'>
            <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
              <Text c='dimmed' size='xs' tt='uppercase' fw={700} style={{ letterSpacing: '0.08em' }}>
                {item.label}
              </Text>
              <Text c='cyan.3' fw={800} fz={32} lh={1} truncate>
                {item.value}
              </Text>
              <Text c='gray.4' size='xs' lineClamp={2}>
                {item.description}
              </Text>
            </Stack>
            {item.icon && (
              <ThemeIcon
                radius='xl'
                size={40}
                color={item.color ?? 'cyan'}
                variant='light'
              >
                {item.icon}
              </ThemeIcon>
            )}
          </Group>
        </Box>
      ))}
    </Box>
  );
}

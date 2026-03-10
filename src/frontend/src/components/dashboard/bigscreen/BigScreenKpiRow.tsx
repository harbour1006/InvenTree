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
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          style={{
            minHeight: 120,
            padding: 18,
            borderRadius: 16,
            border: '1px solid rgba(70, 168, 255, 0.25)',
            background:
              'linear-gradient(180deg, rgba(9, 30, 64, 0.95), rgba(5, 16, 38, 0.98))',
            boxShadow: 'inset 0 0 0 1px rgba(30, 108, 194, 0.15), 0 10px 40px rgba(2, 8, 23, 0.35)'
          }}
        >
          <Group justify='space-between' align='flex-start' wrap='nowrap'>
            <Stack gap={6}>
              <Text c='dimmed' size='sm' tt='uppercase' fw={700} style={{ letterSpacing: '0.08em' }}>
                {item.label}
              </Text>
              <Text c='cyan.3' fw={800} fz={36} lh={1}>
                {item.value}
              </Text>
              <Text c='gray.4' size='sm'>
                {item.description}
              </Text>
            </Stack>
            {item.icon && (
              <ThemeIcon
                radius='xl'
                size={42}
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

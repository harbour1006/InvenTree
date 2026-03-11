import { Box, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function BigScreenPanel({
  title,
  subtitle,
  action,
  children,
  minHeight
}: Readonly<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}>) {
  return (
    <Box
      style={{
        minHeight,
        height: '100%',
        padding: 18,
        borderRadius: 18,
        border: '1px solid rgba(59, 130, 246, 0.3)',
        background:
          'linear-gradient(180deg, rgba(7, 24, 55, 0.92), rgba(3, 14, 35, 0.98))',
        boxShadow:
          'inset 0 1px 0 rgba(125, 211, 252, 0.08), 0 12px 40px rgba(2, 6, 23, 0.42)',
        overflow: 'hidden'
      }}
    >
      <Stack gap='md' h='100%' style={{ minHeight: 0 }}>
        <Group justify='space-between' align='flex-start' wrap='nowrap'>
          <Stack gap={4}>
            <Text c='cyan.3' fw={800} fz='lg'>
              {title}
            </Text>
            {subtitle && (
              <Text c='gray.5' size='sm'>
                {subtitle}
              </Text>
            )}
          </Stack>
          {action}
        </Group>

        <Box
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 12,
            border: '1px solid rgba(96, 165, 250, 0.12)',
            background: 'rgba(8, 20, 44, 0.45)',
            padding: 12,
            overflow: 'auto'
          }}
        >
          {children}
        </Box>
      </Stack>
    </Box>
  );
}

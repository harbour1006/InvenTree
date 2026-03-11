import { useMemo, useState } from 'react';

import { t } from '@lingui/core/macro';
import { LineChart } from '@mantine/charts';
import {
  Badge,
  Box,
  Divider,
  Group,
  Progress,
  RingProgress,
  Stack,
  Table,
  Text,
  ThemeIcon,
  type MantineColor
} from '@mantine/core';
import { useDocumentVisibility } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconBuildingFactory2,
  IconChecklist,
  IconPackage,
  IconReceipt,
  IconShoppingCart,
  IconTruckDelivery
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import { BigScreenHeader } from '../../components/dashboard/bigscreen/BigScreenHeader';
import { BigScreenKpiRow } from '../../components/dashboard/bigscreen/BigScreenKpiRow';
import { BigScreenPanel } from '../../components/dashboard/bigscreen/BigScreenPanel';
import { ProtectedRoute } from '../../components/nav/Layout';
import PageTitle from '../../components/nav/PageTitle';
import { useApi } from '../../contexts/ApiContext';
import { useUserState } from '../../states/UserState';
import { ModelInformationDict } from '@lib/enums/ModelInformation';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';

function useDashboardCount(modelType: ModelType, params?: Record<string, any>) {
  const api = useApi();
  const user = useUserState();
  const visibility = useDocumentVisibility();

  return useQuery({
    queryKey: ['big-screen-count', modelType, params, visibility],
    enabled: user.hasViewPermission(modelType) && visibility === 'visible',
    refetchOnMount: true,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => {
      if (visibility !== 'visible') {
        return null;
      }

      const modelProperties = ModelInformationDict[modelType];

      return api
        .get(apiUrl(modelProperties.api_endpoint), {
          params: {
            ...params,
            limit: 1
          }
        })
        .then((res) => res.data?.count ?? 0);
    }
  });
}

type DashboardListResponse<T> = {
  count: number;
  results: T[];
};

function useDashboardList<T extends Record<string, any>>(
  modelType: ModelType,
  params?: Record<string, any>
) {
  const api = useApi();
  const user = useUserState();
  const visibility = useDocumentVisibility();

  return useQuery<DashboardListResponse<T>>({
    queryKey: ['big-screen-list', modelType, params, visibility],
    enabled: user.hasViewPermission(modelType) && visibility === 'visible',
    refetchOnMount: true,
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => {
      if (visibility !== 'visible') {
        return Promise.resolve({ count: 0, results: [] });
      }

      const modelProperties = ModelInformationDict[modelType];

      return api
        .get(apiUrl(modelProperties.api_endpoint), {
          params
        })
        .then((res) => ({
          count: res.data?.count ?? 0,
          results: res.data?.results ?? []
        }));
    }
  });
}

function formatCount(value?: number | null) {
  if (value === null || value === undefined) {
    return '--';
  }

  return new Intl.NumberFormat().format(value);
}

function formatMetric(query: { isError: boolean; isPending: boolean; data?: number | null }) {
  if (query.isError) {
    return 'ERR';
  }

  if (query.isPending) {
    return '...';
  }

  return formatCount(query.data);
}

function getReferenceLabel(record: Record<string, any>, fallback: string) {
  return record.reference || record.name || record.title || fallback;
}

type BusinessOverviewRange = '7D' | '30D' | '90D' | '12M';

type TickerRow = {
  label: string;
  value: string;
};

const BUSINESS_OVERVIEW_RANGES: BusinessOverviewRange[] = ['7D', '30D', '90D', '12M'];

function getBusinessOverviewConfig(range: BusinessOverviewRange) {
  switch (range) {
    case '7D':
      return {
        points: 7,
        unit: 'day' as const,
        format: 'MM/DD'
      };
    case '30D':
      return {
        points: 30,
        unit: 'day' as const,
        format: 'MM/DD'
      };
    case '90D':
      return {
        points: 13,
        unit: 'week' as const,
        format: 'MM/DD'
      };
    case '12M':
      return {
        points: 12,
        unit: 'month' as const,
        format: 'MMM'
      };
  }
}

function buildBusinessOverviewData(
  range: BusinessOverviewRange,
  purchaseOrders?: Record<string, any>[],
  salesOrders?: Record<string, any>[],
  buildOrders?: Record<string, any>[]
) {
  const config = getBusinessOverviewConfig(range);

  const countForPoint = (records: Record<string, any>[] | undefined, pointDate: dayjs.Dayjs) =>
    records?.filter((record) => {
      const createdAt = dayjs(record.creation_date);

      if (!createdAt.isValid()) {
        return false;
      }

      return createdAt.isSame(pointDate, config.unit);
    }).length ?? 0;

  return Array.from({ length: config.points }, (_, index) => {
    const pointDate = dayjs().subtract(config.points - 1 - index, config.unit);

    return {
      date: pointDate.format(config.format),
      purchaseOrders: countForPoint(purchaseOrders, pointDate),
      salesOrders: countForPoint(salesOrders, pointDate),
      buildOrders: countForPoint(buildOrders, pointDate)
    };
  });
}

function AutoScrollTicker({
  title,
  rows,
  accent = 'cyan'
}: Readonly<{
  title: string;
  rows: TickerRow[];
  accent?: MantineColor;
}>) {
  const baseRows = rows.length > 0 ? rows : [{ label: t`No data`, value: '—' }];
  const tickerRows = [...baseRows, ...baseRows];
  const duration = Math.max(baseRows.length * 3.5, 10);

  return (
    <Stack gap={8} style={{ minWidth: 0 }}>
      <Text c='cyan.3' fw={700} size='sm'>
        {title}
      </Text>
      <Box
        style={{
          position: 'relative',
          height: 138,
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(96, 165, 250, 0.16)',
          background: 'rgba(11, 26, 54, 0.45)'
        }}
      >
        <Box
          style={{
            display: 'flex',
            flexDirection: 'column',
            animation: `bigscreenTicker ${duration}s linear infinite`,
            willChange: 'transform'
          }}
        >
          {tickerRows.map((row, index) => (
            <Group
              key={`${row.label}-${row.value}-${index}`}
              justify='space-between'
              wrap='nowrap'
              style={{
                minHeight: 46,
                padding: '0 12px',
                borderBottom: '1px solid rgba(96, 165, 250, 0.08)'
              }}
            >
              <Text size='sm' truncate style={{ flex: 1, minWidth: 0 }}>
                {row.label}
              </Text>
              <Badge color={accent} variant='outline' size='sm'>
                {row.value}
              </Badge>
            </Group>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

export default function BigScreenDashboard() {
  const [businessOverviewRange, setBusinessOverviewRange] =
    useState<BusinessOverviewRange>('30D');

  const partsCount = useDashboardCount(ModelType.part);
  const stockItemsCount = useDashboardCount(ModelType.stockitem);
  const availableStockCount = useDashboardCount(ModelType.stockitem, { in_stock: true });
  const purchaseOrdersCount = useDashboardCount(ModelType.purchaseorder, {
    outstanding: true
  });
  const overduePurchaseOrdersCount = useDashboardCount(ModelType.purchaseorder, {
    overdue: true
  });
  const salesOrdersCount = useDashboardCount(ModelType.salesorder, {
    outstanding: true
  });
  const activeBuildsCount = useDashboardCount(ModelType.build, { active: true });
  const overdueBuildsCount = useDashboardCount(ModelType.build, { overdue: true });
  const lowStockPartsCount = useDashboardCount(ModelType.part, { low_stock: true });
  const depletedPartsCount = useDashboardCount(ModelType.part, { depleted_stock: true });

  const recentPurchaseOrders = useDashboardList(ModelType.purchaseorder, {
    limit: 400,
    ordering: '-creation_date'
  });
  const recentSalesOrders = useDashboardList(ModelType.salesorder, {
    limit: 400,
    ordering: '-creation_date'
  });
  const recentBuildOrders = useDashboardList(ModelType.build, {
    limit: 400,
    ordering: '-creation_date'
  });

  const criticalAlertCount =
    (depletedPartsCount.data ?? 0) +
    (overduePurchaseOrdersCount.data ?? 0) +
    (overdueBuildsCount.data ?? 0);

  const kpiItems = [
    {
      label: t`Parts`,
      value: formatMetric(partsCount),
      description: t`Total tracked parts`,
      icon: <IconPackage size={18} />,
      color: 'cyan'
    },
    {
      label: t`Stock Items`,
      value: formatMetric(stockItemsCount),
      description: t`Inventory units in system`,
      icon: <IconChecklist size={18} />,
      color: 'blue'
    },
    {
      label: t`Purchase Orders`,
      value: formatMetric(purchaseOrdersCount),
      description: t`Outstanding purchasing workload`,
      icon: <IconShoppingCart size={18} />,
      color: 'indigo'
    },
    {
      label: t`Sales Orders`,
      value: formatMetric(salesOrdersCount),
      description: t`Open customer demand`,
      icon: <IconReceipt size={18} />,
      color: 'teal'
    },
    {
      label: t`Active Builds`,
      value: formatMetric(activeBuildsCount),
      description: t`Manufacturing orders in progress`,
      icon: <IconBuildingFactory2 size={18} />,
      color: 'violet'
    },
    {
      label: t`Critical Alerts`,
      value:
        depletedPartsCount.isPending ||
        overduePurchaseOrdersCount.isPending ||
        overdueBuildsCount.isPending
          ? '...'
          : formatCount(criticalAlertCount),
      description: t`Low stock and overdue execution risks`,
      icon: <IconAlertTriangle size={18} />,
      color: 'red'
    }
  ];

  const alertRows = [
    {
      item: t`Low stock parts`,
      owner: t`Inventory`,
      value: lowStockPartsCount,
      level: t`Warning`,
      color: 'yellow' as MantineColor
    },
    {
      item: t`Depleted parts`,
      owner: t`Inventory`,
      value: depletedPartsCount,
      level: t`Critical`,
      color: 'red' as MantineColor
    },
    {
      item: t`Overdue purchase orders`,
      owner: t`Purchasing`,
      value: overduePurchaseOrdersCount,
      level: t`Warning`,
      color: 'yellow' as MantineColor
    },
    {
      item: t`Overdue build orders`,
      owner: t`Manufacturing`,
      value: overdueBuildsCount,
      level: t`Critical`,
      color: 'red' as MantineColor
    }
  ];

  const normalParts = Math.max(0, (partsCount.data ?? 0) - (lowStockPartsCount.data ?? 0));
  const warningParts = Math.max(
    0,
    (lowStockPartsCount.data ?? 0) - (depletedPartsCount.data ?? 0)
  );
  const depletedParts = depletedPartsCount.data ?? 0;
  const inProductionItems = activeBuildsCount.data ?? 0;
  const totalRiskSegments = normalParts + warningParts + depletedParts + inProductionItems;

  const riskSections = [
    { label: t`Normal`, value: normalParts, color: 'cyan' },
    { label: t`Warning`, value: warningParts, color: 'yellow' },
    { label: t`Depleted`, value: depletedParts, color: 'red' },
    { label: t`In build`, value: inProductionItems, color: 'violet' }
  ];

  const ringSections = riskSections
    .filter((section) => section.value > 0)
    .map((section) => ({
      value: totalRiskSegments > 0 ? (section.value / totalRiskSegments) * 100 : 25,
      color: section.color
    }));

  const flowItems = [
    {
      label: t`Inbound`,
      icon: <IconTruckDelivery size={18} />,
      value: formatMetric(purchaseOrdersCount),
      description: t`Outstanding purchase orders`
    },
    {
      label: t`Available stock`,
      icon: <IconPackage size={18} />,
      value: formatMetric(availableStockCount),
      description: t`Stock items currently in stock`
    },
    {
      label: t`Build queue`,
      icon: <IconBuildingFactory2 size={18} />,
      value: formatMetric(activeBuildsCount),
      description: t`Active manufacturing orders`
    },
    {
      label: t`Outbound`,
      icon: <IconReceipt size={18} />,
      value: formatMetric(salesOrdersCount),
      description: t`Outstanding sales orders`
    }
  ];

  const trendData = Array.from({ length: 7 }, (_, index) => {
    const date = dayjs().subtract(6 - index, 'day').format('YYYY-MM-DD');

    const countByDay = (records?: Record<string, any>[]) =>
      records?.filter((record) => dayjs(record.creation_date).format('YYYY-MM-DD') === date)
        .length ?? 0;

    return {
      date: dayjs(date).format('MM/DD'),
      purchaseOrders: countByDay(recentPurchaseOrders.data?.results),
      salesOrders: countByDay(recentSalesOrders.data?.results),
      buildOrders: countByDay(recentBuildOrders.data?.results)
    };
  });

  const businessOverviewData = useMemo(
    () =>
      buildBusinessOverviewData(
        businessOverviewRange,
        recentPurchaseOrders.data?.results,
        recentSalesOrders.data?.results,
        recentBuildOrders.data?.results
      ),
    [
      businessOverviewRange,
      recentBuildOrders.data?.results,
      recentPurchaseOrders.data?.results,
      recentSalesOrders.data?.results
    ]
  );

  const businessOverviewTotals = businessOverviewData.reduce(
    (totals, row) => ({
      purchaseOrders: totals.purchaseOrders + row.purchaseOrders,
      salesOrders: totals.salesOrders + row.salesOrders,
      buildOrders: totals.buildOrders + row.buildOrders
    }),
    { purchaseOrders: 0, salesOrders: 0, buildOrders: 0 }
  );

  const businessOverviewPeak = businessOverviewData.reduce(
    (peak, row) => Math.max(peak, row.purchaseOrders, row.salesOrders, row.buildOrders),
    0
  );

  const businessOverviewDataPending =
    recentPurchaseOrders.isPending || recentSalesOrders.isPending || recentBuildOrders.isPending;
  const businessOverviewDataError =
    recentPurchaseOrders.isError || recentSalesOrders.isError || recentBuildOrders.isError;

  const businessOverviewSummaryCards = [
    {
      label: t`Purchase created`,
      value: businessOverviewDataPending
        ? '...'
        : businessOverviewDataError
          ? 'ERR'
          : formatCount(businessOverviewTotals.purchaseOrders),
      color: 'cyan.2',
      description: t`New purchase orders in selected range`
    },
    {
      label: t`Sales created`,
      value: businessOverviewDataPending
        ? '...'
        : businessOverviewDataError
          ? 'ERR'
          : formatCount(businessOverviewTotals.salesOrders),
      color: 'blue.2',
      description: t`New sales orders in selected range`
    },
    {
      label: t`Builds created`,
      value: businessOverviewDataPending
        ? '...'
        : businessOverviewDataError
          ? 'ERR'
          : formatCount(businessOverviewTotals.buildOrders),
      color: 'violet.2',
      description: t`New build orders in selected range`
    }
  ];

  const recentOrderActivity =
    trendData.reduce(
      (total, row) => total + row.purchaseOrders + row.salesOrders + row.buildOrders,
      0
    ) || 0;
  const todayActivity = trendData[trendData.length - 1];
  const todayOrderActivity =
    (todayActivity?.purchaseOrders ?? 0) +
    (todayActivity?.salesOrders ?? 0) +
    (todayActivity?.buildOrders ?? 0);

  const recentPurchaseRows =
    recentPurchaseOrders.data?.results?.slice(0, 12).map((order, index) => ({
      label: getReferenceLabel(order, `${t`PO`} ${index + 1}`),
      value: dayjs(order.creation_date).format('MM/DD')
    })) ?? [];

  const recentSalesRows =
    recentSalesOrders.data?.results?.slice(0, 12).map((order, index) => ({
      label: getReferenceLabel(order, `${t`SO`} ${index + 1}`),
      value: dayjs(order.creation_date).format('MM/DD')
    })) ?? [];

  return (
    <ProtectedRoute>
      <>
        <PageTitle title={t`Operations Big Screen`} />
        <Box
          style={{
            width: '100vw',
            height: '100dvh',
            overflow: 'hidden',
            padding: 16,
            background:
              'radial-gradient(circle at top, rgba(21, 94, 117, 0.2), transparent 30%), linear-gradient(180deg, #020817 0%, #07152f 42%, #020617 100%)'
          }}
        >
          <Box
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <Box
              style={{
                width: 'min(100%, calc(100dvh * 16 / 9))',
                height: 'min(100%, calc(100vw * 9 / 16))',
                aspectRatio: '16 / 9',
                color: 'white',
                overflow: 'hidden',
                padding: 16,
                borderRadius: 24,
                border: '1px solid rgba(56, 189, 248, 0.18)',
                background: 'rgba(2, 8, 23, 0.36)',
                boxShadow: 'inset 0 0 0 1px rgba(14, 165, 233, 0.05), 0 18px 60px rgba(2, 6, 23, 0.35)'
              }}
            >
              <Box
                style={{
                  display: 'grid',
                  gridTemplateRows: 'auto auto minmax(0, 1fr)',
                  gap: 14,
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden'
                }}
              >
                <BigScreenHeader title={t`InvenTree Operations Command Center`} />

                <BigScreenKpiRow items={kpiItems} />

                <Box
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.1fr 1.5fr 1.1fr',
                    gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 14,
                    minHeight: 0,
                    overflow: 'hidden'
                  }}
                >
                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Business overview`}
                      subtitle={t`Switchable purchase, sales and production metrics`}
                    >
                      <Stack gap='sm' h='100%' style={{ minHeight: 0, overflow: 'hidden' }}>
                        <Group gap={8}>
                          {BUSINESS_OVERVIEW_RANGES.map((value) => (
                            <Badge
                              key={value}
                              color={businessOverviewRange === value ? 'cyan' : 'gray'}
                              variant='outline'
                              style={{ cursor: 'pointer' }}
                              onClick={() => setBusinessOverviewRange(value)}
                            >
                              {value}
                            </Badge>
                          ))}
                        </Group>

                        <LineChart
                          data={businessOverviewData}
                          h={150}
                          dataKey='date'
                          withLegend
                          curveType='monotone'
                          series={[
                            { name: 'purchaseOrders', label: t`Purchase`, color: 'cyan.5' },
                            { name: 'salesOrders', label: t`Sales`, color: 'blue.5' },
                            { name: 'buildOrders', label: t`Builds`, color: 'violet.5' }
                          ]}
                          gridAxis='xy'
                          tickLine='y'
                          strokeWidth={2}
                        />

                        <Group grow>
                          {businessOverviewSummaryCards.map((card) => (
                            <Box
                              key={card.label}
                              style={{
                                borderRadius: 12,
                                padding: 12,
                                border: '1px solid rgba(96, 165, 250, 0.18)',
                                background: 'rgba(12, 26, 52, 0.55)',
                                minWidth: 0
                              }}
                            >
                              <Text c='gray.5' size='xs'>
                                {card.label}
                              </Text>
                              <Text c={card.color} fw={800} fz={22} mt={6} truncate>
                                {card.value}
                              </Text>
                              <Text c='gray.5' size='xs' mt={4} lineClamp={2}>
                                {card.description}
                              </Text>
                            </Box>
                          ))}
                        </Group>

                        <Group justify='space-between' wrap='nowrap'>
                          <Text c='gray.5' size='xs' truncate>
                            {t`Peak volume: ${formatCount(businessOverviewPeak)}`}
                          </Text>
                          <Text c='gray.5' size='xs'>
                            {businessOverviewDataError
                              ? t`Data source error`
                              : businessOverviewDataPending
                                ? t`Refreshing live data`
                                : t`Live range aggregation`}
                          </Text>
                        </Group>
                      </Stack>
                    </BigScreenPanel>
                  </Box>

                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Operations flow`}
                      subtitle={t`Supply, inventory, manufacturing and fulfillment overview`}
                    >
                      <Group grow align='stretch' h='100%' wrap='nowrap'>
                        {flowItems.map((item, index) => (
                          <Box
                            key={item.label}
                            style={{
                              position: 'relative',
                              padding: 14,
                              borderRadius: 14,
                              border: '1px solid rgba(103, 232, 249, 0.2)',
                              background: 'rgba(11, 34, 68, 0.55)',
                              minWidth: 0
                            }}
                          >
                            <Group mb='sm' gap={8} wrap='nowrap'>
                              <ThemeIcon color='cyan' variant='light' size={34}>
                                {item.icon}
                              </ThemeIcon>
                              <Text fw={700} size='sm' truncate>
                                {item.label}
                              </Text>
                            </Group>
                            <Text c='cyan.2' fw={900} fz={28} truncate>
                              {item.value}
                            </Text>
                            <Text c='gray.5' size='xs' lineClamp={3}>
                              {item.description}
                            </Text>
                            {index < 3 && (
                              <Text
                                c='blue.3'
                                fw={700}
                                style={{ position: 'absolute', right: -10, top: '50%' }}
                              >
                                →
                              </Text>
                            )}
                          </Box>
                        ))}
                      </Group>
                    </BigScreenPanel>
                  </Box>

                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Alert monitor`}
                      subtitle={t`Inventory and execution issues that need attention`}
                    >
                      <Table highlightOnHover withTableBorder={false} withColumnBorders={false}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t`Alert`}</Table.Th>
                            <Table.Th>{t`Domain`}</Table.Th>
                            <Table.Th>{t`Count`}</Table.Th>
                            <Table.Th>{t`Level`}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {alertRows.map((row) => (
                            <Table.Tr key={row.item}>
                              <Table.Td>{row.item}</Table.Td>
                              <Table.Td>{row.owner}</Table.Td>
                              <Table.Td>{formatMetric(row.value)}</Table.Td>
                              <Table.Td>
                                <Badge color={row.color} variant='outline'>
                                  {row.level}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </BigScreenPanel>
                  </Box>

                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Rankings`}
                      subtitle={t`Auto-scrolling newest purchase and sales orders`}
                    >
                      <Stack gap='sm' h='100%' justify='space-between' style={{ overflow: 'hidden' }}>
                        <Group grow align='stretch' wrap='nowrap'>
                          <AutoScrollTicker title={t`Newest PO`} rows={recentPurchaseRows} accent='cyan' />
                          <AutoScrollTicker title={t`Newest SO`} rows={recentSalesRows} accent='blue' />
                        </Group>
                        <Group grow>
                          <Box
                            style={{
                              borderRadius: 12,
                              padding: 12,
                              border: '1px solid rgba(96, 165, 250, 0.18)',
                              background: 'rgba(12, 26, 52, 0.55)'
                            }}
                          >
                            <Text c='gray.5' size='xs'>
                              {t`Outstanding PO`}
                            </Text>
                            <Text c='cyan.2' fw={800} fz={24} mt={6}>
                              {formatMetric(purchaseOrdersCount)}
                            </Text>
                          </Box>
                          <Box
                            style={{
                              borderRadius: 12,
                              padding: 12,
                              border: '1px solid rgba(96, 165, 250, 0.18)',
                              background: 'rgba(12, 26, 52, 0.55)'
                            }}
                          >
                            <Text c='gray.5' size='xs'>
                              {t`Outstanding SO`}
                            </Text>
                            <Text c='blue.2' fw={800} fz={24} mt={6}>
                              {formatMetric(salesOrdersCount)}
                            </Text>
                          </Box>
                        </Group>
                      </Stack>
                    </BigScreenPanel>
                  </Box>

                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Operations trend`}
                      subtitle={t`New purchase, sales and build orders created over the last 7 days`}
                    >
                      <Stack gap='md' h='100%' justify='space-between' style={{ overflow: 'hidden' }}>
                        <LineChart
                          data={trendData}
                          h={160}
                          dataKey='date'
                          withLegend
                          curveType='monotone'
                          series={[
                            { name: 'purchaseOrders', label: t`Purchase`, color: 'cyan.5' },
                            { name: 'salesOrders', label: t`Sales`, color: 'blue.5' },
                            { name: 'buildOrders', label: t`Builds`, color: 'violet.5' }
                          ]}
                          gridAxis='xy'
                          tickLine='y'
                          strokeWidth={2}
                        />
                        <Group grow>
                          <Box>
                            <Text c='gray.5' size='sm'>
                              {t`7 day activity`}
                            </Text>
                            <Text c='cyan.2' fw={800} fz={28}>
                              {formatCount(recentOrderActivity)}
                            </Text>
                          </Box>
                          <Divider orientation='vertical' />
                          <Box>
                            <Text c='gray.5' size='sm'>
                              {t`Today created`}
                            </Text>
                            <Text c='blue.2' fw={800} fz={28}>
                              {formatCount(todayOrderActivity)}
                            </Text>
                          </Box>
                        </Group>
                      </Stack>
                    </BigScreenPanel>
                  </Box>

                  <Box style={{ minHeight: 0 }}>
                    <BigScreenPanel
                      title={t`Inventory risk distribution`}
                      subtitle={t`Normal, warning, depleted and in-build coverage`}
                    >
                      <Stack gap='md' h='100%' justify='space-between' style={{ overflow: 'hidden' }}>
                        <Group justify='space-between' align='center' wrap='nowrap'>
                          <RingProgress
                            size={150}
                            thickness={16}
                            sections={
                              ringSections.length > 0
                                ? ringSections
                                : [
                                    { value: 25, color: 'cyan' },
                                    { value: 25, color: 'yellow' },
                                    { value: 25, color: 'red' },
                                    { value: 25, color: 'violet' }
                                  ]
                            }
                            label={
                              <Text ta='center' c='cyan.2' fw={700} size='sm'>
                                {formatMetric(lowStockPartsCount)}
                              </Text>
                            }
                          />

                          <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
                            {riskSections.map((section) => {
                              const percent = totalRiskSegments > 0 ? (section.value / totalRiskSegments) * 100 : 0;

                              return (
                                <Box key={section.label}>
                                  <Group justify='space-between' mb={4} wrap='nowrap'>
                                    <Text size='sm'>{section.label}</Text>
                                    <Text c='gray.5' size='xs'>
                                      {formatCount(section.value)} · {percent.toFixed(0)}%
                                    </Text>
                                  </Group>
                                  <Progress value={percent} color={section.color} radius='xl' size='lg' />
                                </Box>
                              );
                            })}
                          </Stack>
                        </Group>

                        <Group grow>
                          <Box
                            style={{
                              borderRadius: 12,
                              padding: 12,
                              border: '1px solid rgba(96, 165, 250, 0.18)',
                              background: 'rgba(12, 26, 52, 0.55)'
                            }}
                          >
                            <Text c='gray.5' size='xs'>
                              {t`Depleted parts`}
                            </Text>
                            <Text c='red.2' fw={800} fz={24} mt={6}>
                              {formatMetric(depletedPartsCount)}
                            </Text>
                          </Box>
                          <Box
                            style={{
                              borderRadius: 12,
                              padding: 12,
                              border: '1px solid rgba(96, 165, 250, 0.18)',
                              background: 'rgba(12, 26, 52, 0.55)'
                            }}
                          >
                            <Text c='gray.5' size='xs'>
                              {t`Active builds`}
                            </Text>
                            <Text c='violet.2' fw={800} fz={24} mt={6}>
                              {formatMetric(activeBuildsCount)}
                            </Text>
                          </Box>
                        </Group>
                      </Stack>
                    </BigScreenPanel>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <style>{`
          @keyframes bigscreenTicker {
            from { transform: translateY(0); }
            to { transform: translateY(-50%); }
          }
        `}</style>
      </>
    </ProtectedRoute>
  );
}

import { useMemo, useState } from 'react';

import { t } from '@lingui/core/macro';
import { LineChart } from '@mantine/charts';
import {
  Badge,
  Box,
  Divider,
  Group,
  List,
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

import { ModelInformationDict } from '@lib/enums/ModelInformation';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import { BigScreenKpiRow } from '../../components/dashboard/bigscreen/BigScreenKpiRow';
import { BigScreenPanel } from '../../components/dashboard/bigscreen/BigScreenPanel';
import { useApi } from '../../contexts/ApiContext';
import { ProtectedRoute } from '../../components/nav/Layout';
import PageTitle from '../../components/nav/PageTitle';
import { useUserState } from '../../states/UserState';

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

function formatListCount(query: {
  isError: boolean;
  isPending: boolean;
  data?: DashboardListResponse<Record<string, any>>;
}) {
  if (query.isError) {
    return 'ERR';
  }

  if (query.isPending) {
    return '...';
  }

  return formatCount(query.data?.count ?? 0);
}

function getReferenceLabel(record: Record<string, any>, fallback: string) {
  return record.reference || record.name || record.title || fallback;
}

type BusinessOverviewRange = '7D' | '30D' | '90D' | '12M';

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
  const topRiskParts = useDashboardList(ModelType.part, {
    low_stock: true,
    limit: 5,
    ordering: 'total_in_stock'
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
      icon: <IconPackage size={20} />,
      color: 'cyan'
    },
    {
      label: t`Stock Items`,
      value: formatMetric(stockItemsCount),
      description: t`Inventory units in the system`,
      icon: <IconChecklist size={20} />,
      color: 'blue'
    },
    {
      label: t`Purchase Orders`,
      value: formatMetric(purchaseOrdersCount),
      description: t`Outstanding purchasing workload`,
      icon: <IconShoppingCart size={20} />,
      color: 'indigo'
    },
    {
      label: t`Sales Orders`,
      value: formatMetric(salesOrdersCount),
      description: t`Open customer demand`,
      icon: <IconReceipt size={20} />,
      color: 'teal'
    },
    {
      label: t`Active Builds`,
      value: formatMetric(activeBuildsCount),
      description: t`Manufacturing orders in progress`,
      icon: <IconBuildingFactory2 size={20} />,
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
      description: t`Low stock, overdue orders and build issues`,
      icon: <IconAlertTriangle size={20} />,
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

  const normalParts = Math.max(
    0,
    (partsCount.data ?? 0) - (lowStockPartsCount.data ?? 0)
  );
  const warningParts = Math.max(
    0,
    (lowStockPartsCount.data ?? 0) - (depletedPartsCount.data ?? 0)
  );
  const depletedParts = depletedPartsCount.data ?? 0;
  const inProductionItems = activeBuildsCount.data ?? 0;
  const totalRiskSegments = normalParts + warningParts + depletedParts + inProductionItems;

  const riskSections = [
    { value: normalParts, color: 'cyan' },
    { value: warningParts, color: 'yellow' },
    { value: depletedParts, color: 'red' },
    { value: inProductionItems, color: 'violet' }
  ]
    .filter((section) => section.value > 0)
    .map((section) => ({
      ...section,
      value: totalRiskSegments > 0 ? (section.value / totalRiskSegments) * 100 : 25
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
    (peak, row) =>
      Math.max(peak, row.purchaseOrders, row.salesOrders, row.buildOrders),
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

  const rankingRows =
    topRiskParts.data?.results?.map((part, index) => ({
      label: getReferenceLabel(part, `${t`Part`} ${index + 1}`),
      value: formatCount(part.total_in_stock ?? part.in_stock ?? 0),
      description:
        part.IPN ||
        (part.total_in_stock !== undefined
          ? t`In stock: ${formatCount(part.total_in_stock)}`
          : t`Low stock`)
    })) ?? [];

  const recentPurchaseRows =
    recentPurchaseOrders.data?.results?.slice(0, 3).map((order, index) => ({
      label: getReferenceLabel(order, `${t`PO`} ${index + 1}`),
      value: dayjs(order.creation_date).format('MM/DD')
    })) ?? [];

  const recentSalesRows =
    recentSalesOrders.data?.results?.slice(0, 3).map((order, index) => ({
      label: getReferenceLabel(order, `${t`SO`} ${index + 1}`),
      value: dayjs(order.creation_date).format('MM/DD')
    })) ?? [];

  return (
    <ProtectedRoute>
      <>
        <PageTitle title={t`Operations Big Screen`} />
        <Box
          style={{
            minHeight: '100vh',
            padding: 24,
            color: 'white',
            background:
              'radial-gradient(circle at top, rgba(21, 94, 117, 0.2), transparent 30%), linear-gradient(180deg, #020817 0%, #07152f 42%, #020617 100%)'
          }}
        >
          <Stack gap='lg' style={{ minHeight: 'calc(100vh - 48px)' }}>
            <Group justify='space-between' align='flex-end'>
              <Stack gap={4}>
                <Text c='cyan.3' fz={30} fw={900} tt='uppercase' style={{ letterSpacing: '0.12em' }}>
                  {t`InvenTree Operations Command Center`}
                </Text>
                <Text c='gray.4'>
                  {t`Cross-domain cockpit for inventory, purchasing, sales and manufacturing`}
                </Text>
              </Stack>
              <Badge size='lg' radius='sm' variant='light' color='cyan'>
                {t`Live data`}
              </Badge>
            </Group>

            <BigScreenKpiRow items={kpiItems} />

            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 1.5fr 1.1fr',
                gap: 16,
                flex: 1,
                minHeight: 0
              }}
            >
              <Stack gap='md' style={{ minHeight: 0 }}>
                <BigScreenPanel
                  title={t`Alert monitor`}
                  subtitle={t`Inventory and execution issues that need attention`}
                  minHeight={320}
                >
                  <Table striped highlightOnHover withTableBorder={false} withColumnBorders={false}>
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
                            <Badge color={row.color} variant='light'>
                              {row.level}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </BigScreenPanel>

                <BigScreenPanel
                  title={t`Inventory risk distribution`}
                  subtitle={t`Normal, warning and depleted part coverage`}
                  minHeight={220}
                >
                  <Group justify='space-between' h='100%' align='center'>
                    <RingProgress
                      size={180}
                      thickness={18}
                      sections={
                        riskSections.length > 0
                          ? riskSections
                          : [
                              { value: 25, color: 'cyan' },
                              { value: 25, color: 'yellow' },
                              { value: 25, color: 'red' },
                              { value: 25, color: 'violet' }
                            ]
                      }
                      label={
                        <Text ta='center' c='cyan.2' fw={700} size='lg'>
                          {formatMetric(lowStockPartsCount)}
                        </Text>
                      }
                    />
                    <Stack gap='xs'>
                      <Text c='gray.3'>
                        {t`Normal / Low stock / Depleted / In production`}
                      </Text>
                      <Text c='gray.5' size='sm'>
                        {t`Low stock parts: ${formatMetric(lowStockPartsCount)}`}
                      </Text>
                      <Text c='gray.5' size='sm'>
                        {t`Depleted parts: ${formatMetric(depletedPartsCount)}`}
                      </Text>
                      <Text c='gray.5' size='sm'>
                        {t`Active builds: ${formatMetric(activeBuildsCount)}`}
                      </Text>
                    </Stack>
                  </Group>
                </BigScreenPanel>
              </Stack>

              <Stack gap='md' style={{ minHeight: 0 }}>
                <BigScreenPanel
                  title={t`Operations flow`}
                  subtitle={t`Supply, inventory, manufacturing and fulfillment overview`}
                  minHeight={360}
                >
                  <Group grow align='stretch'>
                    {flowItems.map((item, index) => (
                      <Box
                        key={item.label}
                        style={{
                          position: 'relative',
                          padding: 16,
                          borderRadius: 14,
                          border: '1px solid rgba(103, 232, 249, 0.2)',
                          background: 'rgba(11, 34, 68, 0.55)'
                        }}
                      >
                        <Group mb='sm'>
                          <ThemeIcon color='cyan' variant='light'>
                            {item.icon}
                          </ThemeIcon>
                          <Text fw={700}>{item.label}</Text>
                        </Group>
                        <Text c='cyan.2' fw={900} fz={32}>
                          {item.value}
                        </Text>
                        <Text c='gray.5' size='sm'>
                          {item.description}
                        </Text>
                        {index < 3 && (
                          <Text
                            c='blue.3'
                            fw={700}
                            style={{ position: 'absolute', right: -12, top: '50%' }}
                          >
                            →
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Group>
                </BigScreenPanel>

                <BigScreenPanel
                  title={t`Operations trend`}
                  subtitle={t`New purchase, sales and build orders created over the last 7 days`}
                  minHeight={260}
                >
                  <Stack gap='md' h='100%' justify='space-between'>
                    <LineChart
                      data={trendData}
                      h={140}
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
              </Stack>

              <Stack gap='md' style={{ minHeight: 0 }}>
                <BigScreenPanel
                  title={t`Business overview`}
                  subtitle={t`Switchable purchase, sales and production metrics`}
                  minHeight={250}
                >
                  <Stack gap='md' h='100%' justify='space-between'>
                    <Group>
                      {BUSINESS_OVERVIEW_RANGES.map((value) => (
                        <Badge
                          key={value}
                          color={businessOverviewRange === value ? 'cyan' : 'gray'}
                          variant='light'
                          style={{ cursor: 'pointer' }}
                          onClick={() => setBusinessOverviewRange(value)}
                        >
                          {value}
                        </Badge>
                      ))}
                    </Group>

                    <LineChart
                      data={businessOverviewData}
                      h={140}
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
                            padding: 14,
                            border: '1px solid rgba(96, 165, 250, 0.18)',
                            background: 'rgba(12, 26, 52, 0.55)'
                          }}
                        >
                          <Text c='gray.5' size='sm'>
                            {card.label}
                          </Text>
                          <Text c={card.color} fw={800} fz={24} mt='xs'>
                            {card.value}
                          </Text>
                          <Text c='gray.5' size='xs' mt={6}>
                            {card.description}
                          </Text>
                        </Box>
                      ))}
                    </Group>

                    <Group justify='space-between'>
                      <Text c='gray.5' size='sm'>
                        {t`Peak daily / weekly / monthly volume: ${formatCount(businessOverviewPeak)}`}
                      </Text>
                      <Text c='gray.5' size='sm'>
                        {businessOverviewDataError
                          ? t`Data source error`
                          : businessOverviewDataPending
                            ? t`Refreshing live data`
                            : t`Live range aggregation`}
                      </Text>
                    </Group>
                  </Stack>
                </BigScreenPanel>

                <BigScreenPanel
                  title={t`Execution scorecards`}
                  subtitle={t`First live operational summary cards`}
                  minHeight={190}
                >
                  <Group grow h='100%' align='stretch'>
                    <Box
                      style={{
                        borderRadius: 12,
                        padding: 14,
                        border: '1px solid rgba(96, 165, 250, 0.18)',
                        background: 'rgba(12, 26, 52, 0.55)'
                      }}
                    >
                      <Text c='gray.5' size='sm'>
                        {t`In-stock items`}
                      </Text>
                      <Text c='cyan.2' fw={800} fz={26} mt='sm'>
                        {formatMetric(availableStockCount)}
                      </Text>
                    </Box>
                    <Box
                      style={{
                        borderRadius: 12,
                        padding: 14,
                        border: '1px solid rgba(96, 165, 250, 0.18)',
                        background: 'rgba(12, 26, 52, 0.55)'
                      }}
                    >
                      <Text c='gray.5' size='sm'>
                        {t`Overdue orders`}
                      </Text>
                      <Text c='blue.2' fw={800} fz={26} mt='sm'>
                        {formatCount(
                          (overduePurchaseOrdersCount.data ?? 0) +
                            (overdueBuildsCount.data ?? 0)
                        )}
                      </Text>
                    </Box>
                  </Group>
                </BigScreenPanel>

                <BigScreenPanel
                  title={t`Rankings`}
                  subtitle={t`Live top risk parts and newest order references`}
                  minHeight={240}
                >
                  <Stack gap='md'>
                    <Box>
                      <Group justify='space-between' mb='xs'>
                        <Text c='cyan.3' fw={700}>{t`Top low stock parts`}</Text>
                        <Text c='gray.5' size='sm'>{formatListCount(topRiskParts)}</Text>
                      </Group>
                      <List
                        spacing='xs'
                        icon={
                          <ThemeIcon color='cyan' variant='light' size={24} radius='xl'>
                            <IconChecklist size={14} />
                          </ThemeIcon>
                        }
                      >
                        {rankingRows.map((row) => (
                          <List.Item key={row.label}>
                            <Group justify='space-between' align='flex-start'>
                              <Box>
                                <Text>{row.label}</Text>
                                <Text c='gray.5' size='xs'>{row.description}</Text>
                              </Box>
                              <Text c='gray.5'>{row.value}</Text>
                            </Group>
                          </List.Item>
                        ))}
                      </List>
                    </Box>
                    <Divider />
                    <Group grow align='flex-start'>
                      <Box>
                        <Text c='cyan.3' fw={700} mb='xs'>{t`Newest PO`}</Text>
                        <Stack gap={4}>
                          {recentPurchaseRows.map((row) => (
                            <Group key={row.label} justify='space-between'>
                              <Text size='sm'>{row.label}</Text>
                              <Text c='gray.5' size='xs'>{row.value}</Text>
                            </Group>
                          ))}
                        </Stack>
                      </Box>
                      <Box>
                        <Text c='cyan.3' fw={700} mb='xs'>{t`Newest SO`}</Text>
                        <Stack gap={4}>
                          {recentSalesRows.map((row) => (
                            <Group key={row.label} justify='space-between'>
                              <Text size='sm'>{row.label}</Text>
                              <Text c='gray.5' size='xs'>{row.value}</Text>
                            </Group>
                          ))}
                        </Stack>
                      </Box>
                    </Group>
                  </Stack>
                </BigScreenPanel>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </>
    </ProtectedRoute>
  );
}

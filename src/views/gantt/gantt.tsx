import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, Button, DndProvider } from "@axelor/ui";
import {
  ConnectProps,
  GANTT_TYPES,
  Gantt as GanttComponent,
  GanttField,
  GanttRecord,
  GanttType,
} from "@axelor/ui/gantt";
import { MaterialIcon } from "@axelor/ui/icons/material-icon";

import { dialogs } from "@/components/dialogs";
import { PageText } from "@/components/page-text";
import { useManyEditor } from "@/hooks/use-relation";
import { SearchOptions } from "@/services/client/data";
import { DataRecord } from "@/services/client/data.types";
import { i18n } from "@/services/client/i18n";
import { moment } from "@/services/client/l10n";
import { Field, GanttView, Widget } from "@/services/client/meta.types";
import { DEFAULT_PAGE_SIZE } from "@/utils/app-settings.ts";
import format from "@/utils/format";
import { ViewToolBar } from "@/view-containers/view-toolbar";
import { useViewTab, useViewTabRefresh } from "@/view-containers/views/scope";

import { ViewProps } from "../types";
import { formatRecord, transformRecord } from "./utils";

import styles from "./gantt.module.scss";

const connectSetTypes = {
  start_finish: "startToFinish",
  finish_finish: "finishToFinish",
  start_start: "startToStart",
  finish_start: "finishToStart",
} as const;

function TreeCell({
  value,
  data,
  onExpand,
}: {
  value: any;
  data: GanttRecord & {
    _level?: number;
    _expand?: boolean;
  };
  field: GanttField;
  onExpand?: (record: DataRecord, expand?: boolean) => void;
}) {
  const { _level: level, _children: children, _expand: expand = true } = data;
  const hasChildren = Boolean(children?.length);
  return (
    <Box
      d="flex"
      alignItems="center"
      className={styles.cell}
      gap={4}
      {...(level && {
        style: {
          paddingLeft: `${(level - 1) * 0.75}rem`,
        },
      })}
      {...(hasChildren && {
        fontWeight: "bold",
      })}
    >
      <Box d="flex">
        {hasChildren ? (
          <MaterialIcon
            className={styles.icon}
            icon={expand ? "arrow_drop_down" : "arrow_right"}
            onClick={() => onExpand?.(data, !expand)}
          />
        ) : (
          <Box style={{ width: 20 }} />
        )}
        <MaterialIcon
          className={styles.icon}
          icon={hasChildren ? "folder_open" : "description"}
          fontSize={hasChildren ? "1.5rem" : "1.4rem"}
        />
      </Box>
      <Box as="span">{value}</Box>
    </Box>
  );
}

function ActionsCell({
  data,
  onAdd,
  onRemove,
}: {
  data: DataRecord;
  onAdd?: (record: DataRecord) => void;
  onRemove?: (record: DataRecord) => void;
}) {
  return (
    <Box d="flex" className={styles.cell}>
      <MaterialIcon
        className={styles.icon}
        icon="add"
        fontSize={"1.3rem"}
        onClick={() => onAdd?.(data)}
      />
      <MaterialIcon
        className={styles.icon}
        icon="close"
        fontSize={"1.3rem"}
        onClick={() => onRemove?.(data)}
      />
    </Box>
  );
}

function fieldFormatter(column: Field, value: any, record: any) {
  return format(value, {
    props: column,
    context: record,
  });
}

export function Gantt({ dataStore, meta }: ViewProps<GanttView>) {
  const [type, setType] = useState<GanttType>(GANTT_TYPES.WEEK);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const { action, dashlet } = useViewTab();
  const showEditor = useManyEditor(action, dashlet);

  const { fields, view } = meta;
  const { items } = view;
  const { domain, context } = action;

  const { formatter, transformer } = useMemo(
    () => ({
      formatter: (record: DataRecord) => formatRecord(view, record),
      transformer: (record: DataRecord) => transformRecord(view, record),
    }),
    [view]
  );

  const handleExpand = useCallback(
    (record: DataRecord, _expand?: boolean) =>
      setRecords((records) =>
        records.map((r) => (r.id === record.id ? { ...r, _expand } : r))
      ),
    []
  );

  const onSearch = useCallback(
    async (options?: SearchOptions) => {
      const { records } = await dataStore.search({
        ...options,
        filter: {
          _domain: domain || undefined,
          _domainContext: context,
        },
      });
      setRecords(records);
    },
    [dataStore, domain, context]
  );

  const updateRecord = useCallback(
    async (data: DataRecord) => {
      const record = transformer(data);
      const updated = await dataStore.save(record);
      updated &&
        setRecords((records) =>
          records.map((r) =>
            r.id === record.id ? { ...r, ...formatter(updated) } : r
          )
        );
    },
    [transformer, formatter, dataStore]
  );

  const handleRecordConnect = useCallback(
    ({ startId, finishId, source, target }: ConnectProps) => {
      const set = connectSetTypes[`${source}_${target}`];
      const record = records.find((r) => r.id === finishId);
      if (record) {
        const $set: DataRecord[] = record[set] || [];
        if (!$set?.find((obj) => String(obj.id) === String(startId))) {
          return updateRecord({
            ...record,
            [set]: [...$set, { id: startId }],
          });
        }
      }
    },
    [records, updateRecord]
  );

  const handleRecordDisconnect = useCallback(
    ({ startId, finishId, source, target }: ConnectProps) => {
      const set = connectSetTypes[`${source}_${target}`];
      const record = records.find((r) => r.id === finishId);
      if (record) {
        const $set: DataRecord[] = record[set] || [];
        return updateRecord({
          ...record,
          [set]: $set?.filter((obj) => String(obj.id) !== String(startId)),
        });
      }
    },
    [records, updateRecord]
  );

  const handleRecordUpdate = useCallback(
    (record: DataRecord, changes: DataRecord) =>
      updateRecord({ ...record, ...changes }),
    [updateRecord]
  );

  const handleRecordRemove = useCallback(
    async (record: DataRecord) => {
      const confirmed = await dialogs.confirm({
        content: i18n.get("Do you really want to delete the selected task?"),
        yesTitle: i18n.get("Delete"),
      });
      if (confirmed) {
        const { id, version } = record;
        if (id) {
          const res = await dataStore.delete({ id, version: version ?? 0 });
          res && setRecords((records) => records.filter((r) => r.id !== id));
        }
      }
    },
    [dataStore]
  );

  const handleRecordEdit = useCallback(
    (record: DataRecord) => {
      const { model, title } = view;
      const isNew = !record.id;
      model &&
        showEditor({
          title: title ?? "",
          model,
          record,
          readonly: false,
          onSelect: (record: DataRecord) => {
            setRecords((records) => {
              return isNew
                ? [...records, record]
                : records.map((r) =>
                    r.id === record.id ? { ...r, ...record } : r
                  );
            });
          },
        });
    },
    [view, showEditor]
  );

  const handleRecordAddSubTask = useCallback(
    async (record?: DataRecord) => {
      const { taskParent, taskDuration, taskProgress, taskStart } = view;
      handleRecordEdit({
        ...(taskStart && {
          [taskStart]: moment().format("YYYY-MM-DDTHH:mm:ss[Z]"),
        }),
        ...(taskDuration && { [taskDuration]: 1 }),
        ...(taskProgress && { [taskProgress]: 0 }),
        ...(taskParent &&
          record && {
            [taskParent]: {
              id: record.id,
              version: record.version,
              name: record.name,
            },
          }),
      });
    },
    [view, handleRecordEdit]
  );

  useEffect(() => {
    onSearch();
  }, [onSearch]);

  useEffect(() => {
    return dataStore.subscribe(() => {
      setRecords(dataStore.records);
    });
  }, [dataStore]);

  const { page } = dataStore;
  const { offset = 0, limit = DEFAULT_PAGE_SIZE, totalCount = 0 } = page;

  const canPrev = offset > 0;
  const canNext = offset + limit < totalCount;

  const ganttItems = useMemo(
    () =>
      (items || [])
        .concat(
          view.taskUser
            ? [{ type: "field", name: view.taskUser } as Widget]
            : []
        )
        .map((item, ind) => ({
          ...(ind === 0 && {
            width: 160,
            renderer: (props: any) => (
              <TreeCell {...props} onExpand={handleExpand} />
            ),
          }),
          ...item,
          ...fields?.[item.name!],
          formatter: fieldFormatter,
        }))
        .concat([
          {
            title: (
              <Box d="flex">
                <MaterialIcon
                  className={styles.icon}
                  icon="add"
                  onClick={() => handleRecordAddSubTask()}
                />
              </Box>
            ),
            name: "$actions",
            renderer: (props: any) => (
              <ActionsCell
                {...props}
                onAdd={handleRecordAddSubTask}
                onRemove={handleRecordRemove}
              />
            ),
            width: 60,
          } as any,
        ]) as unknown as GanttField[],
    [
      view,
      items,
      fields,
      handleExpand,
      handleRecordAddSubTask,
      handleRecordRemove,
    ]
  );

  const ganttRecords = useMemo(() => {
    const getParent = (task: DataRecord) => task[view.taskParent!];

    function collect(
      parent?: DataRecord["id"],
      level: number = 1
    ): DataRecord[] {
      return records
        .filter(
          (item) =>
            item[view.taskStart!] &&
            (parent
              ? (getParent(item) || {}).id === parent
              : getParent(item) === parent)
        )
        .reduce((list, _item) => {
          const item: DataRecord = { ..._item, _level: level };
          const subTasks = collect(item.id, level + 1);

          return list.concat([
            subTasks.length
              ? { ...item, _children: subTasks.map((t) => t.id) }
              : item,
            ...(item._expand === false ? [] : subTasks),
          ]);
        }, []) as DataRecord[];
    }

    const list = collect(null);
    return list.map(formatter) as GanttRecord[];
  }, [view, formatter, records]);

  // register tab:refresh
  useViewTabRefresh("gantt", onSearch);

  const FILTERS: { key: GanttType; title: string }[] = useMemo(
    () => [
      { key: GANTT_TYPES.YEAR, title: i18n.get("Year") },
      { key: GANTT_TYPES.MONTH, title: i18n.get("Month") },
      { key: GANTT_TYPES.WEEK, title: i18n.get("Week") },
      { key: GANTT_TYPES.DAY, title: i18n.get("Day") },
    ],
    [],
  );
  
  return (
    <Box d="flex" className={styles.container} flex={1} flexDirection="column">
      <ViewToolBar
        meta={meta}
        actions={[]}
        pagination={{
          canPrev,
          canNext,
          onPrev: () => onSearch({ offset: offset - limit }),
          onNext: () => onSearch({ offset: offset + limit }),
          text: () => <PageText dataStore={dataStore} />,
        }}
      >
        <Box d="flex" gap={4}>
          {FILTERS.map((filter) => {
            const active = type === filter.key;
            return (
              <Button
                key={filter.key}
                variant="secondary"
                outline={!active}
                onClick={() => setType(filter.key)}
              >
                {filter.title}
              </Button>
            );
          })}
          <Button variant="secondary" outline ms={2} onClick={() => onSearch()}>
            {i18n.get("Refresh")}
          </Button>
          <Button variant="secondary" outline>
            {i18n.get("Print")}
          </Button>
        </Box>
      </ViewToolBar>
      <Box d="flex" flex={1} overflow="auto" px={1}>
        <DndProvider>
          <GanttComponent
            className={styles.gantt}
            view={type}
            items={ganttItems}
            records={ganttRecords}
            onRecordView={handleRecordEdit}
            onRecordConnect={handleRecordConnect}
            onRecordDisconnect={handleRecordDisconnect}
            onRecordUpdate={handleRecordUpdate}
          />
        </DndProvider>
      </Box>
    </Box>
  );
}

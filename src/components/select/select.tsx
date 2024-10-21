import clsx from "clsx";
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Box,
  Select as AxSelect,
  SelectProps as AxSelectProps,
  SelectCustomOption,
  SelectValue,
  useRefs,
} from "@axelor/ui";

import { i18n } from "@/services/client/i18n";

import styles from "./select.module.scss";
import { MaterialIcon } from "@axelor/ui/icons/material-icon";

export type {
  SelectCustomOption,
  SelectIcon,
  SelectOptionProps,
  SelectValue,
} from "@axelor/ui";

export interface SelectProps<Type, Multiple extends boolean>
  extends AxSelectProps<Type, Multiple> {
  canSelect?: boolean;
  fetchOptions?: (inputValue: string) => Promise<Type[]>;
  canCreateOnTheFly?: boolean;
  canShowNoResultOption?: boolean;
  onShowCreateAndSelect?: (inputValue: string) => void;
  onShowCreate?: (inputValue: string) => void;
  onShowSelect?: (inputValue: string) => void;
}

const EMPTY: any[] = [];

export const Select = forwardRef(function Select<
  Type,
  Multiple extends boolean,
>(props: SelectProps<Type, Multiple>, ref: ForwardedRef<HTMLDivElement>) {
  const {
    autoFocus,
    readOnly,
    className,
    options,
    fetchOptions,
    onShowCreate,
    onShowSelect,
    onShowCreateAndSelect,
    onInputChange,
    onOpen,
    canSelect = true,
    openOnFocus = true,
    value = null,
    onChange,
    menuOptions,
    ...selectProps
  } = props;

  const [items, setItems] = useState<Type[]>([]);
  const [inputValue, setInputValue] = useState("");

  const [ready, setReady] = useState(!fetchOptions);
  const selectRef = useRefs(ref);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const loadOptions = useCallback(
    (inputValue: string) => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
      }

      loadTimerRef.current = setTimeout(
        async () => {
          if (fetchOptions) {
            const items = await fetchOptions(inputValue);
            loadTimerRef.current = undefined;
            setItems(items || []);
            setReady(true);
          }
        },
        inputValue ? 300 : 0,
      );
    },
    [fetchOptions],
  );

  const handleOpen = useCallback(() => {
    if (onOpen) onOpen();
    if (fetchOptions && !inputValue && !loadTimerRef.current) {
      loadOptions("");
    }
  }, [fetchOptions, inputValue, loadOptions, onOpen]);

  const handleClose = useCallback(() => {
    setReady(false);
  }, []);

  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      if (onInputChange) onInputChange(text);
      if (fetchOptions) {
        if (text) {
          loadOptions(text);
        }
      }
    },
    [fetchOptions, loadOptions, onInputChange],
  );

  const handleChange = useCallback(
    (value: SelectValue<Type, Multiple>) => {
      onChange?.(value);
    },
    [onChange],
  );

  useEffect(() => {
    clearTimeout(loadTimerRef.current);
  }, []);

  useEffect(() => {
    if (autoFocus && selectRef.current) {
      selectRef.current.focus();
    }
  }, [autoFocus, selectRef]);

  const currOptions = fetchOptions ? (ready ? items : EMPTY) : options;
  const hasOptions = currOptions.length > 0;

  const customOptions = useMemo(() => {
    const options: SelectCustomOption[] = [];

    if (onShowSelect && hasOptions) {
      options.push({
        key: "select",
        title: (
          <Box d="flex" gap={6} alignItems="center">
            <MaterialIcon icon="search" className={styles.icon} />
            <em>{i18n.get("Search more...")}</em>
          </Box>
        ),
        onClick: () => onShowSelect(inputValue),
      });
    } else if (selectProps.canShowNoResultOption && !hasOptions) {
      options.push({
        key: "no-result",
        title: (
          <Box d="flex" gap={6} alignItems="center">
            <em>{i18n.get("No results found")}</em>
          </Box>
        ),
      });
    }

    const canShowCreateWithInput =
      selectProps.canCreateOnTheFly && onShowCreate && inputValue;
    const canShowCreateWithInputAndSelect =
      selectProps.canCreateOnTheFly && onShowCreateAndSelect && inputValue;

    if (canShowCreateWithInput) {
      options.push({
        key: "create-with-input",
        title: (
          <Box d="flex" gap={6} alignItems="center">
            <MaterialIcon icon="add" className={styles.icon} />
            <em>{i18n.get(`Create "{0}"...`, inputValue)}</em>
          </Box>
        ),
        onClick: () => onShowCreate(inputValue),
      });
    } else if (onShowCreate) {
      options.push({
        key: "create",
        title: (
          <Box d="flex" gap={6} alignItems="center">
            <MaterialIcon icon="add" className={styles.icon} />
            <em>{i18n.get("Create...")}</em>
          </Box>
        ),
        onClick: () => onShowCreate(""),
      });
    }

    if (canShowCreateWithInputAndSelect) {
      options.push({
        key: "create-and-select",
        title: (
          <Box d="flex" gap={6} alignItems="center">
            <MaterialIcon icon="add_task" className={styles.icon} />
            <em>{i18n.get(`Create "{0}" and select...`, inputValue)}</em>
          </Box>
        ),
        onClick: () => onShowCreateAndSelect(inputValue),
      });
    }

    return options;
  }, [
    hasOptions,
    inputValue,
    selectProps.canCreateOnTheFly,
    onShowCreate,
    onShowCreateAndSelect,
    onShowSelect,
    selectProps.canShowNoResultOption,
  ]);

  return (
    <AxSelect
      clearOnBlur
      clearOnEscape
      {...selectProps}
      ref={selectRef}
      value={value}
      autoFocus={autoFocus}
      readOnly={readOnly || !canSelect}
      openOnFocus={openOnFocus}
      options={currOptions}
      customOptions={ready ? customOptions : EMPTY}
      onInputChange={handleInputChange}
      onOpen={handleOpen}
      onChange={handleChange}
      className={clsx(className, { [styles.readonly]: readOnly })}
      menuOptions={{
        maxWidth: 600,
        ...menuOptions,
      }}
      {...(fetchOptions && {
        onClose: handleClose,
      })}
    />
  );
}) as unknown as <Type, Multiple extends boolean>(
  props: SelectProps<Type, Multiple>,
  ref: ForwardedRef<HTMLDivElement>,
) => React.ReactNode;

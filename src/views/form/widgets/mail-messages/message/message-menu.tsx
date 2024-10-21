import { i18n } from "@/services/client/i18n";
import { useState } from "react";
import { Message, MessageFlag } from "./types";
import { MaterialIcon } from "@axelor/ui/icons/material-icon";
import { Box, Menu, MenuItem } from "@axelor/ui";
import styles from "./message-menu.module.scss";
import clsx from "clsx";

export function MessageMenu({
  data,
  onReply,
  onAction,
  onRemove,
}: {
  data: Message;
  onAction: ($flags: Partial<MessageFlag>, reload?: boolean) => void;
  onReply?: (e: React.SyntheticEvent) => void;
  onRemove?: (data: Message) => void;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  const open = Boolean(target);
  const _t = i18n.get;
  const id = open ? `actions-popover-${data.id}` : undefined;
  const { $flags, $thread, $canDelete } = data;
  const { isRead, isStarred, isArchived } = ($flags || {}) as MessageFlag;

  function onOpen({ target }: React.MouseEvent<HTMLSpanElement>) {
    setTarget(target as HTMLElement);
  }

  function onClose() {
    setTarget(null);
  }

  function onRead() {
    onAction({ isRead: !isRead });
    onClose();
  }

  function onStarred() {
    onAction({ isStarred: !isStarred });
    onClose();
  }

  function onArchived() {
    onAction({ isArchived: !isArchived }, true);
    onClose();
  }

  function onDelete() {
    onRemove && onRemove(data);
    onClose();
  }

  return (
    <>
      <Box
        d="flex"
        alignItems="center"
        position="absolute"
        className={styles.icons}
      >
        {$thread && (
          <Box
            px={1}
            as="span"
            aria-label="reply"
            className={styles.icon}
            onClick={onReply}
          >
            <MaterialIcon icon="reply" />
          </Box>
        )}
        <Box
          px={1}
          as="span"
          aria-describedby={id}
          aria-label="open"
          className={clsx(styles.icon, styles["pull-right"])}
          onClick={onOpen}
        >
          <MaterialIcon icon="arrow_drop_down" />
        </Box>
      </Box>
      <Menu show={open} target={target} onHide={onClose} placement="bottom-end">
        <MenuItem onClick={onRead}>
          {isRead ? _t("Mark as unread") : _t("Mark as read")}
        </MenuItem>
        <MenuItem onClick={onStarred}>
          {isStarred ? _t("Mark as not important") : _t("Mark as important")}
        </MenuItem>
        {$thread && (
          <MenuItem onClick={onArchived}>
            {isArchived ? _t("Move to inbox") : _t("Move to archive")}
          </MenuItem>
        )}
        {$canDelete && <MenuItem onClick={onDelete}>Delete</MenuItem>}
      </Menu>
    </>
  );
}

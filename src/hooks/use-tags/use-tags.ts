import { useCallback, useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { atomWithImmer } from "jotai-immer";
import { selectAtom } from "jotai/utils";
import { isEqual } from "lodash";

import { Tag } from "@/services/client/meta.types";
import { SocketChannel } from "@/services/client/socket";

const tagsAtom = atomWithImmer<{
  tasks: {
    current: number;
    pending: number;
  };
  mail: {
    total: number;
    unread: number;
  };
  tags: Tag[];
}>({
  tasks: {
    current: 0,
    pending: 0,
  },
  mail: {
    total: 0,
    unread: 0,
  },
  tags: [],
});

export function useTagsState() {
  return useAtomValue(tagsAtom);
}

export function useTagsList() {
  return useAtomValue(
    useMemo(() => selectAtom(tagsAtom, (state) => state.tags), [])
  );
}

export function useTagsMail() {
  return useAtomValue(
    useMemo(() => selectAtom(tagsAtom, (state) => state.mail), [])
  );
}

export function useTagsTasks() {
  return useAtomValue(
    useMemo(() => selectAtom(tagsAtom, (state) => state.tasks), [])
  );
}

const tagsChannel = new SocketChannel("tags");

export function useTags() {
  const setTags = useSetAtom(tagsAtom);

  const fetchTags = useCallback(async function refresh() {
    const names = Array.from(document.querySelectorAll("[data-tag-name]"))
      .map((el) => (el as HTMLElement).dataset.tagName)
      .filter((tag) => tag);

    return tagsChannel.send(names);
  }, []);

  useEffect(() => {
    return tagsChannel.subscribe((message: any) => {
      const { mail, tasks, tags } = message?.values || {};
      setTags((draft) => {
        if (tasks) {
          draft.tasks.current = tasks.current ?? 0;
          draft.tasks.pending = tasks.pending ?? 0;
        }
        if (mail) {
          draft.mail.total = mail.total ?? 0;
          draft.mail.unread = mail.unread ?? 0;
        }
        if (!isEqual(tags, draft.tags)) {
          draft.tags = tags;
        }
      });
    });
  }, [setTags]);

  return { fetchTags };
}

"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { computeDraftPickUpdate, spliceReorder } from "./boardOps";
import type { BoardState, DraftStatus, FirestoreBoardDoc } from "./types";

export interface BoardSummary {
  id: string;
  name: string;
  updatedAt: Date | null;
  draftedCount: number;
}

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

export function useUserBoards(uid: string | null): { boards: BoardSummary[]; loading: boolean } {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "boards"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBoards(
          snap.docs.map((d) => {
            const data = d.data() as FirestoreBoardDoc;
            return {
              id: d.id,
              name: data.name,
              updatedAt: toDate(data.updatedAt),
              draftedCount: Object.keys(data.draftPicks ?? {}).length,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);

  if (!uid) return { boards: [], loading: false };
  return { boards, loading };
}

interface FirestoreBoardActions {
  reorderPlayer: (activeId: string, overId: string) => void;
  resetOrder: (orderedIds: string[]) => void;
  setDraftStatus: (playerId: string, status: DraftStatus) => void;
  undraft: (playerId: string) => void;
  rename: (name: string) => void;
}

export function useFirestoreBoard(
  uid: string | null,
  boardId: string | null
): {
  board: BoardState | null;
  name: string | null;
  loading: boolean;
  notFound: boolean;
  actions: FirestoreBoardActions;
} {
  const [doc_, setDoc_] = useState<FirestoreBoardDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid || !boardId) return;
    const ref = doc(db, "users", uid, "boards", boardId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setDoc_(null);
          setNotFound(true);
        } else {
          setDoc_(snap.data() as FirestoreBoardDoc);
        }
        setLoading(false);
      },
      () => {
        setDoc_(null);
        setNotFound(true);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid, boardId]);

  const actions: FirestoreBoardActions = {
    reorderPlayer: (activeId, overId) => {
      if (!uid || !boardId || !doc_) return;
      const next = spliceReorder(doc_.customOrder, activeId, overId);
      if (!next) return;
      void updateDoc(doc(db, "users", uid, "boards", boardId), {
        customOrder: next,
        updatedAt: serverTimestamp(),
      });
    },
    resetOrder: (orderedIds) => {
      if (!uid || !boardId) return;
      void updateDoc(doc(db, "users", uid, "boards", boardId), {
        customOrder: orderedIds,
        updatedAt: serverTimestamp(),
      });
    },
    setDraftStatus: (playerId, status) => {
      if (!uid || !boardId || !doc_) return;
      const { pick } = computeDraftPickUpdate(doc_.draftPicks[playerId], status, doc_.nextPickNumber);
      void updateDoc(doc(db, "users", uid, "boards", boardId), {
        [`draftPicks.${playerId}`]: pick,
        nextPickNumber: doc_.draftPicks[playerId] ? doc_.nextPickNumber : increment(1),
        updatedAt: serverTimestamp(),
      });
    },
    undraft: (playerId) => {
      if (!uid || !boardId) return;
      void updateDoc(doc(db, "users", uid, "boards", boardId), {
        [`draftPicks.${playerId}`]: deleteField(),
        updatedAt: serverTimestamp(),
      });
    },
    rename: (name) => {
      if (!uid || !boardId) return;
      void updateDoc(doc(db, "users", uid, "boards", boardId), {
        name,
        updatedAt: serverTimestamp(),
      });
    },
  };

  if (!uid || !boardId) return { board: null, name: null, loading: false, notFound: false, actions };
  return { board: doc_, name: doc_?.name ?? null, loading, notFound, actions };
}

export async function createBoard(
  uid: string,
  name: string,
  orderedIds: string[],
  season: number
): Promise<string> {
  const ref = await addDoc(collection(db, "users", uid, "boards"), {
    name,
    season,
    customOrder: orderedIds,
    draftPicks: {},
    nextPickNumber: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameBoard(uid: string, boardId: string, name: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "boards", boardId), { name, updatedAt: serverTimestamp() });
}

export async function deleteBoard(uid: string, boardId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "boards", boardId));
}

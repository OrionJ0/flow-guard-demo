import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Result, Spin } from "antd";
import type { ApprovalScene, Workflow } from "./types";
import { mockSceneApi } from "./services/sceneRepository";
import SceneManagementPage from "./pages/SceneManagementPage";
import WorkflowConfigPage from "./pages/WorkflowConfigPage";

type Route =
  | { page: "scenes" }
  | { page: "workflow"; sceneId: string };

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  const match = hash.match(/^\/workflow\/(.+)$/);
  if (match) return { page: "workflow", sceneId: decodeURIComponent(match[1]) };
  return { page: "scenes" };
}

function goToScenes() {
  window.location.hash = "/scenes";
}

function goToWorkflow(sceneId: string) {
  window.location.hash = `/workflow/${encodeURIComponent(sceneId)}`;
}

export default function App() {
  const { message } = AntApp.useApp();
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [scenes, setScenes] = useState<ApprovalScene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    mockSceneApi
      .list()
      .then(setScenes)
      .finally(() => setLoading(false));
  }, []);

  const persistScenes = async (nextScenes: ApprovalScene[]) => {
    setScenes(nextScenes);
    await mockSceneApi.saveAll(nextScenes);
  };

  const activeScene = useMemo(() => {
    if (route.page !== "workflow") return undefined;
    return scenes.find((scene) => scene.id === route.sceneId);
  }, [route, scenes]);

  if (loading) {
    return (
      <div className="page-loader">
        <Spin size="large" />
      </div>
    );
  }

  if (route.page === "workflow") {
    if (!activeScene) {
      return (
        <Result
          status="404"
          title="未找到审批场景"
          subTitle="该场景可能已被删除或本地数据被重置。"
          extra={
            <button className="plain-link" type="button" onClick={goToScenes}>
              返回场景列表
            </button>
          }
        />
      );
    }

    return (
      <WorkflowConfigPage
        scene={activeScene}
        onBack={goToScenes}
        onSaveWorkflow={async (workflow: Workflow) => {
          const next = scenes.map((scene) =>
            scene.id === activeScene.id
              ? {
                  ...scene,
                  workflow,
                  updatedAt: new Date().toISOString(),
                }
              : scene,
          );
          await persistScenes(next);
          message.success("流程配置已保存");
        }}
      />
    );
  }

  return (
    <SceneManagementPage
      scenes={scenes}
      onChangeScenes={persistScenes}
      onReset={async () => {
        const seeded = await mockSceneApi.reset();
        setScenes(seeded);
        message.success("示例场景已恢复");
      }}
      onConfigure={goToWorkflow}
    />
  );
}

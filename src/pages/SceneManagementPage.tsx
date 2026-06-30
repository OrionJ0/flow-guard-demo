import { useMemo, useRef, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircle2,
  Copy,
  Files,
  ListTree,
  Pencil,
  PowerOff,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { createScene, uid } from "../data/workflowFactory";
import { parseWorkflowImport } from "../domain/workflowImport";
import { buildWorkflowValidation, hasBlockingValidationErrors } from "../domain/workflowValidation";
import {
  markWorkflowChanged,
  publishWorkflow,
  stopWorkflow,
  workflowStatusColor,
} from "../domain/workflowStatus";
import type { ApprovalScene, SceneTag, WorkflowStatus } from "../types";

const { Text, Title } = Typography;

interface SceneManagementPageProps {
  scenes: ApprovalScene[];
  onChangeScenes: (scenes: ApprovalScene[]) => Promise<void>;
  onReset: () => Promise<void>;
  onConfigure: (sceneId: string) => void;
}

interface SceneFormValues {
  name: string;
  tag: SceneTag;
  desc?: string;
}

const tagColor: Record<SceneTag, string> = {
  自定义: "blue",
  高危: "red",
  强制: "orange",
  受控: "processing",
  通用: "green",
};

function countApprovals(scene: ApprovalScene) {
  return scene.workflow.elements.filter((element) => element.type === "approval")
    .length;
}

function countBranches(scene: ApprovalScene) {
  return scene.workflow.edges.filter((edge) => edge.kind === "branch").length;
}

function cloneScene(scene: ApprovalScene): ApprovalScene {
  const copy = JSON.parse(JSON.stringify(scene)) as ApprovalScene;
  copy.id = uid("scene");
  copy.name = `${scene.name} 副本`;
  copy.workflow.name = `${copy.name}审批`;
  copy.workflow.status = "草稿";
  copy.updatedAt = new Date().toISOString();
  return copy;
}

function statusActionLabel(scene: ApprovalScene) {
  if (scene.workflow.status === "已启用") return "停用";
  if (scene.workflow.status === "有未发布变更") return "发布";
  return "启用";
}

export default function SceneManagementPage({
  scenes,
  onChangeScenes,
  onReset,
  onConfigure,
}: SceneManagementPageProps) {
  const { message } = AntApp.useApp();
  const [modal, contextHolder] = Modal.useModal();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"" | WorkflowStatus>("");
  const [editingScene, setEditingScene] = useState<ApprovalScene | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form] = Form.useForm<SceneFormValues>();

  const filteredScenes = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();
    return scenes.filter((scene) => {
      const text = `${scene.name} ${scene.desc} ${scene.tag}`.toLowerCase();
      return (
        (!lowerKeyword || text.includes(lowerKeyword)) &&
        (!status || scene.workflow.status === status)
      );
    });
  }, [keyword, scenes, status]);

  const metrics = useMemo(
    () => ({
      sceneCount: scenes.length,
      enabledCount: scenes.filter((scene) => scene.workflow.status === "已启用")
        .length,
      approvalCount: scenes.reduce((sum, scene) => sum + countApprovals(scene), 0),
      branchCount: scenes.reduce((sum, scene) => sum + countBranches(scene), 0),
    }),
    [scenes],
  );

  const openCreate = () => {
    setEditingScene(null);
    form.setFieldsValue({ name: "", tag: "自定义", desc: "" });
    setDialogOpen(true);
  };

  const openEdit = (scene: ApprovalScene) => {
    setEditingScene(scene);
    form.setFieldsValue({
      name: scene.name,
      tag: scene.tag,
      desc: scene.desc,
    });
    setDialogOpen(true);
  };

  const saveScene = async () => {
    const values = await form.validateFields();
    if (editingScene) {
      await onChangeScenes(
        scenes.map((scene) => {
          if (scene.id !== editingScene.id) return scene;
          const workflow = markWorkflowChanged(scene.workflow);
          return {
            ...scene,
            name: values.name,
            tag: values.tag,
            desc: values.desc || "",
            updatedAt: new Date().toISOString(),
            workflow: {
              ...workflow,
              name: `${values.name}审批`,
            },
          };
        }),
      );
    } else {
      await onChangeScenes([
        createScene(values.name, values.tag, values.desc || ""),
        ...scenes,
      ]);
    }
    setDialogOpen(false);
  };

  const deleteScene = (scene: ApprovalScene) => {
    modal.confirm({
      title: "删除审批场景",
      content: `确认删除审批场景「${scene.name}」？删除后本地流程配置也会移除。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => onChangeScenes(scenes.filter((item) => item.id !== scene.id)),
    });
  };

  const resetDemo = () => {
    modal.confirm({
      title: "恢复示例场景",
      content: "当前本地自定义场景会被示例数据覆盖，确认继续？",
      okText: "恢复示例",
      cancelText: "取消",
      onOk: onReset,
    });
  };

  const changeWorkflowStatus = async (scene: ApprovalScene) => {
    if (scene.workflow.status === "已启用") {
      await onChangeScenes(
        scenes.map((item) =>
          item.id === scene.id
            ? { ...item, workflow: stopWorkflow(item.workflow), updatedAt: new Date().toISOString() }
            : item,
        ),
      );
      message.success("流程已停用");
      return;
    }

    const validations = buildWorkflowValidation(scene.workflow);
    if (hasBlockingValidationErrors(validations)) {
      const failed = validations.find((item) => !item.ok);
      modal.warning({
        title: "流程校验未通过",
        content: failed ? `${failed.title}：${failed.detail}` : "请先完善流程配置。",
        okText: "去配置",
        onOk: () => onConfigure(scene.id),
      });
      return;
    }

    await onChangeScenes(
      scenes.map((item) =>
        item.id === scene.id
          ? { ...item, workflow: publishWorkflow(item.workflow), updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    message.success(scene.workflow.status === "有未发布变更" ? "变更已发布" : "流程已启用");
  };

  const importSceneJson = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseWorkflowImport(await file.text()).scene;
      const duplicate = scenes.some((scene) => scene.id === imported.id);
      const nextScene: ApprovalScene = {
        ...imported,
        id: duplicate ? uid("scene") : imported.id,
        name: duplicate ? `${imported.name} 导入` : imported.name,
        updatedAt: new Date().toISOString(),
      };
      await onChangeScenes([nextScene, ...scenes]);
      const validations = buildWorkflowValidation(nextScene.workflow);
      if (hasBlockingValidationErrors(validations)) {
        message.warning("JSON 已导入，流程存在校验问题，请进入配置页查看");
      } else {
        message.success("JSON 已导入为新场景");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    }
  };

  return (
    <div className="app-shell">
      {contextHolder}
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon brand-icon-blue">
            <ListTree size={18} />
          </span>
          <span>
            <strong>审批场景管理</strong>
            <em>先维护业务场景，再进入对应流程配置</em>
          </span>
        </div>
        <Space wrap>
          <Button icon={<Upload size={16} />} onClick={() => importInputRef.current?.click()}>
            导入 JSON
          </Button>
          <Button icon={<RotateCcw size={16} />} onClick={resetDemo}>
            恢复示例
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            新增场景
          </Button>
        </Space>
        <input
          ref={importInputRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void importSceneJson(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </header>

      <main className="page-main">
        <section className="page-heading">
          <Text type="secondary">系统管理 / 流程审批 / 审批场景</Text>
          <Title level={2}>审批场景</Title>
          <p>
            审批场景由用户自定义维护。每个场景拥有独立流程，可进入配置页设置审批人、条件分支和抄送人。
          </p>
        </section>

        <Row gutter={[12, 12]} className="summary-row">
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="场景数量" value={metrics.sceneCount} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="已启用" value={metrics.enabledCount} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="审批节点" value={metrics.approvalCount} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="条件分支" value={metrics.branchCount} />
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <span className="panel-title">
              <Files size={17} />
              场景列表
            </span>
          }
        >
          <div className="filter-line">
            <Input
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="输入场景名称、说明或标签"
            />
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "全部" },
                { value: "已启用", label: "已启用" },
                { value: "有未发布变更", label: "有未发布变更" },
                { value: "草稿", label: "草稿" },
                { value: "已停用", label: "已停用" },
              ]}
            />
            <Button
              icon={<X size={16} />}
              onClick={() => {
                setKeyword("");
                setStatus("");
              }}
            >
              清空
            </Button>
          </div>

          {filteredScenes.length ? (
            <Row gutter={[12, 12]}>
              {filteredScenes.map((scene) => (
                <Col xs={24} md={12} xl={8} key={scene.id}>
                  <Card className="scene-card">
                    <div className="scene-card-head">
                      <div>
                        <Title level={4}>{scene.name}</Title>
                        <p>{scene.desc || "未填写说明"}</p>
                      </div>
                      <Tag color={tagColor[scene.tag]}>{scene.tag}</Tag>
                    </div>

                    <div className="scene-meta-grid">
                      <div>
                        <span>审批节点</span>
                        <strong>{countApprovals(scene)}</strong>
                      </div>
                      <div>
                        <span>条件分支</span>
                        <strong>{countBranches(scene)}</strong>
                      </div>
                      <div>
                        <span>状态</span>
                        <Tag
                          className="scene-status-tag"
                          color={workflowStatusColor(scene.workflow.status)}
                        >
                          {scene.workflow.status}
                        </Tag>
                      </div>
                    </div>

                    <div className="scene-actions">
                      <Space wrap>
                        <Button
                          type="primary"
                          icon={<Workflow size={16} />}
                          onClick={() => onConfigure(scene.id)}
                        >
                          配置流程
                        </Button>
                        <Button
                          size="small"
                          danger={scene.workflow.status === "已启用"}
                          icon={
                            scene.workflow.status === "已启用" ? (
                              <PowerOff size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )
                          }
                          onClick={() => void changeWorkflowStatus(scene)}
                        >
                          {statusActionLabel(scene)}
                        </Button>
                      </Space>
                      <Space>
                        <Button
                          aria-label="编辑"
                          icon={<Pencil size={16} />}
                          onClick={() => openEdit(scene)}
                        />
                        <Button
                          aria-label="复制"
                          icon={<Copy size={16} />}
                          onClick={() => onChangeScenes([...scenes, cloneScene(scene)])}
                        />
                        <Button
                          aria-label="删除"
                          danger
                          icon={<Trash2 size={16} />}
                          onClick={() => deleteScene(scene)}
                        />
                      </Space>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="暂无匹配场景，可以调整筛选条件或新增审批场景" />
          )}
        </Card>
      </main>

      <Modal
        title={editingScene ? "编辑场景" : "新增场景"}
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={saveScene}
        okText="保存"
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="场景名称"
            name="name"
            rules={[{ required: true, message: "请填写场景名称" }]}
          >
            <Input placeholder="例如：高危数据访问、备案报表导出" />
          </Form.Item>
          <Form.Item label="场景标签" name="tag" initialValue="自定义">
            <Select
              options={["自定义", "高危", "强制", "受控", "通用"].map((tag) => ({
                value: tag,
                label: tag,
              }))}
            />
          </Form.Item>
          <Form.Item label="说明" name="desc">
            <Input.TextArea
              rows={4}
              placeholder="说明这个场景适用的业务范围、触发动作或风险要求"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

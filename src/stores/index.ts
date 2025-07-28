import { makeAutoObservable } from 'mobx';

class AppStore {
  // 应用状态
  isLoading = false;
  currentUser: any = null;
  theme = 'light';
  
  // 低代码编辑器状态
  components: any[] = [];
  selectedComponent: any = null;
  canvasData: any[] = [];
  
  // 3D场景状态
  threeScene: any = null;
  threeObjects: any[] = [];
  
  // 图表数据
  chartData: {
    line: any;
    bar: any;
    pie: any[];
  } = {
    line: {},
    bar: {},
    pie: []
  };

  constructor() {
    makeAutoObservable(this);
  }

  // 应用状态方法
  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
  }

  setTheme(theme: string) {
    this.theme = theme;
  }

  // 低代码编辑器方法
  addComponent(component: any) {
    this.components.push(component);
  }

  selectComponent(component: any) {
    this.selectedComponent = component;
  }

  updateCanvasData(data: any[]) {
    this.canvasData = data;
  }

  // 3D场景方法
  setThreeScene(scene: any) {
    this.threeScene = scene;
  }

  addThreeObject(object: any) {
    this.threeObjects.push(object);
  }

  // 图表数据方法
  updateChartData(type: string, data: any[]) {
    this.chartData[type as keyof typeof this.chartData] = data;
  }
}

export const appStore = new AppStore(); 
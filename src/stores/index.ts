import { makeAutoObservable, observable, action } from 'mobx';
import { theme } from 'antd';

type Theme = 'light' | 'dark';

class AppStore {
  // 应用状态
  loading = false;
  currentUser: any = null;
  theme: Theme = 'light';
  
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
    makeAutoObservable(this, {
      loading: observable,
      theme: observable,
      setLoading: action,
      toggleTheme: action,
    });
  }

  // 应用状态方法
  setLoading(loading: boolean) {
    this.loading = loading;
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
  }

  setTheme(theme: string) {
    this.theme = theme;
  }

  toggleTheme = () => {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
  };

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
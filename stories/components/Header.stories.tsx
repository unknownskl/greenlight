import Header from "../../renderer/components/header";

export default {
  title: "Components/Header",
  component: Header,
};

// export const HeaderNavigation = () => <Header />
export const HeaderNavigation = (args) => <Header {...args} />
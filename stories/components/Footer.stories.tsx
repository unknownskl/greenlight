import Footer from "../../renderer/components/footer";

export default {
  title: "Components/Footer",
  component: Footer,
};

// export const HeaderNavigation = () => <Footer />
export const FooterNavigation = (args) => <Footer {...args} />

export const FooterNavigationDisabled = FooterNavigation.bind({});
FooterNavigationDisabled.args = {
  hidden: true,
};

export const FooterNavigationDisconnected = FooterNavigation.bind({});
FooterNavigationDisconnected.args = {
  connected: false
};

export const FooterNavigationConnected = FooterNavigation.bind({});
FooterNavigationConnected.args = {
  connected: true
};